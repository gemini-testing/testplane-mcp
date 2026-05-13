import { readResultsFromReport } from "html-reporter/experimental/sdk";
import type { WdioBrowser } from "testplane";
import { createErrorResponse, createSimpleResponse } from "../../responses/index.js";
import {
    type CaptureSnapshotOptions,
    getPageSnapshot,
    type PageSnapshotResult,
    convertSnapshotToResponse,
} from "../../responses/browser-helpers.js";
import { StandaloneTool, ToolKind } from "../../types.js";
import { downloadReportIfNeeded } from "../../utils/html-report.js";
import { launchBrowserWithOptions } from "../launch-browser.js";
import { loadTimeTravelArchive, type TimeTravelArchive, resolveTargetTime } from "./rrweb-snapshots.js";
import {
    findReportTestResult,
    getReportDefaultTime,
    getSnapshotAttachment,
    resolveSnapshotAttachmentSource,
} from "./report.js";
import { startTimeTravelRenderServer, type TimeTravelRenderServer } from "./render-server.js";
import { timeTravelSnapshotObjectSchema, timeTravelSnapshotSchema, type TimeTravelSnapshotArgs } from "./schema.js";
import { diffPageSnapshots } from "./snapshot-diff.js";
import { SelectedSnapshotTime, SnapshotInputSelection } from "./types.js";
import { formatResponse } from "./formatters.js";

export { timeTravelSnapshotObjectSchema, timeTravelSnapshotSchema } from "./schema.js";
export { loadTimeTravelArchive as loadRrwebSnapshotArchive, resolveTargetTime } from "./rrweb-snapshots.js";
export {
    findReportTestResult,
    getReportDefaultTime,
    getSnapshotAttachment,
    resolveSnapshotAttachmentSource,
} from "./report.js";
export { diffPageSnapshots } from "./snapshot-diff.js";

const RENDER_TIMEOUT_MS = 15_000;

function getSnapshotOptions(args: TimeTravelSnapshotArgs): CaptureSnapshotOptions {
    return {
        includeTags: args.includeTags,
        includeAttrs: args.includeAttrs,
        excludeTags: args.excludeTags,
        excludeAttrs: args.excludeAttrs,
        truncateText: args.truncateText,
        maxTextLength: args.maxTextLength,
    };
}

async function getSnapshotInput(args: TimeTravelSnapshotArgs): Promise<SnapshotInputSelection> {
    if (args.snapshotFile) {
        return {
            mode: "direct",
            source: args.snapshotFile,
        };
    }

    const reportPath = await downloadReportIfNeeded(args.report!);
    const results = await readResultsFromReport(reportPath);
    const result = findReportTestResult(results, {
        name: args.name!,
        browser: args.browser!,
        attempt: args.attempt,
    });
    const attachment = getSnapshotAttachment(result);
    const source = await resolveSnapshotAttachmentSource(args.report!, reportPath, attachment.path);

    return {
        mode: "report",
        source,
        result,
        defaultTime: getReportDefaultTime(result),
    };
}

function getWindowSize(archive: TimeTravelArchive): { width: number; height: number } {
    return {
        width: Math.min(Math.max(Math.ceil(archive.metadata.width ?? 1280), 800), 1920),
        height: Math.min(Math.max(Math.ceil(archive.metadata.height ?? 720), 600), 1080),
    };
}

async function waitForRender(browser: WdioBrowser): Promise<void> {
    let renderError: string | undefined;

    await browser.waitUntil(
        async () => {
            const status = (await browser.execute(() => {
                const root = document.documentElement;

                return {
                    ready: root.dataset.timeTravelReady === "true",
                    error: root.dataset.timeTravelError,
                };
            })) as { ready: boolean; error?: string };

            renderError = status.error;

            return status.ready || Boolean(status.error);
        },
        {
            timeout: RENDER_TIMEOUT_MS,
            interval: 100,
            timeoutMsg: `Time travel snapshot renderer did not become ready within ${RENDER_TIMEOUT_MS}ms.`,
        },
    );

    if (renderError) {
        throw new Error(`Time travel snapshot renderer failed: ${renderError}`);
    }
}

async function captureRenderedSnapshot(
    archive: TimeTravelArchive,
    selectedTime: SelectedSnapshotTime,
    snapshotOptions: CaptureSnapshotOptions,
): Promise<PageSnapshotResult> {
    let server: TimeTravelRenderServer | null = null;
    let browser: WdioBrowser | null = null;

    try {
        server = await startTimeTravelRenderServer(archive.events, selectedTime.offsetMs);
        browser = await launchBrowserWithOptions({
            headless: true,
            windowSize: getWindowSize(archive),
        });

        await browser.openAndWait(server.url, { ignoreNetworkErrorsPatterns: [/.*/], timeout: RENDER_TIMEOUT_MS });
        await waitForRender(browser);

        const iframe = await browser.$('iframe[data-time-travel-target="true"]');
        await iframe.waitForExist({ timeout: 5_000 });
        await browser.switchFrame(iframe);

        const snapshot = await getPageSnapshot(browser, snapshotOptions);
        if (!snapshot) {
            throw new Error("Failed to capture DOM snapshot from rrweb iframe.");
        }

        return snapshot;
    } finally {
        if (browser) {
            try {
                await browser.switchFrame(null);
            } catch {
                // The browser may already be closed or not inside a frame.
            }

            try {
                await browser.deleteSession();
            } catch (error) {
                console.error("Error closing time travel snapshot browser:", error);
            }
        }

        if (server) {
            try {
                await server.close();
            } catch (error) {
                console.error("Error closing time travel snapshot render server:", error);
            }
        }
    }
}

const timeTravelSnapshotCb: StandaloneTool<typeof timeTravelSnapshotSchema>["cb"] = async rawArgs => {
    try {
        const args = timeTravelSnapshotObjectSchema.parse(rawArgs);
        const input = await getSnapshotInput(args);
        const archive = await loadTimeTravelArchive(input.source);
        const selectedTime = resolveTargetTime(archive.metadata, {
            time: args.time,
            defaultAbsoluteTime: input.defaultTime?.absoluteTime,
            defaultReason: input.defaultTime?.reason,
        });
        const snapshotOptions = getSnapshotOptions(args);

        const currentSnapshot = await captureRenderedSnapshot(archive, selectedTime, snapshotOptions);
        let outputSnapshot = currentSnapshot;

        const diffFromTime =
            args.diffFrom === undefined
                ? undefined
                : resolveTargetTime(archive.metadata, {
                      time: args.diffFrom,
                  });
        if (diffFromTime) {
            const baselineSnapshot = await captureRenderedSnapshot(archive, diffFromTime, snapshotOptions);
            outputSnapshot = diffPageSnapshots(baselineSnapshot, currentSnapshot);
        }
        const snapshotResponse = await convertSnapshotToResponse(outputSnapshot);

        return createSimpleResponse(formatResponse(args, input, archive, selectedTime, diffFromTime, snapshotResponse));
    } catch (error) {
        console.error("Error capturing time travel snapshot:", error);

        return createErrorResponse("Error capturing time travel snapshot", error instanceof Error ? error : undefined);
    }
};

export const timeTravelSnapshot: StandaloneTool<typeof timeTravelSnapshotSchema> = {
    kind: ToolKind.Standalone,
    name: "time-travel-snapshot",
    description:
        "Inspect Testplane Time Travel rrweb snapshot at a selected time and return a DOM snapshot of the replayed page, optionally with a diff from a previous time",
    schema: timeTravelSnapshotSchema,
    cb: timeTravelSnapshotCb,
    cli: {
        section: "Reports",
        examples: [
            'testplane-cli time-travel-snapshot /path/to/html-report --name "checkout submits order" --browser chrome',
            'testplane-cli time-travel-snapshot /path/to/html-report --name "checkout submits order" --browser chrome --time 250',
            'testplane-cli time-travel-snapshot /path/to/html-report --name "checkout submits order" --browser chrome --time 250 --diff-from 100',
            "testplane-cli time-travel-snapshot --snapshot-file /path/to/snapshot.zip --time 100",
        ],
        positional: ["report"],
    },
};
