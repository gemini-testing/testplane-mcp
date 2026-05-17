import path from "path";
import fs from "fs/promises";
import os from "os";
import { randomUUID } from "node:crypto";
import { WdioBrowser } from "testplane";
import { formatTimestamp } from "../utils/formatters.js";

export interface BrowserTab {
    title: string;
    url: string;
    isActive: boolean;
}

export async function getBrowserTabs(browser: WdioBrowser): Promise<BrowserTab[]> {
    try {
        const windowHandles = await browser.getWindowHandles();
        const currentHandle = await browser.getWindowHandle();

        const tabs: BrowserTab[] = [];

        for (const handle of windowHandles) {
            await browser.switchToWindow(handle);
            const title = await browser.getTitle();
            const url = await browser.getUrl();

            tabs.push({
                title: title || "Untitled",
                url: url || "about:blank",
                isActive: handle === currentHandle,
            });
        }

        await browser.switchToWindow(currentHandle);

        return tabs;
    } catch (error) {
        console.error("Error getting browser tabs:", error);
        return [];
    }
}

export interface CaptureSnapshotOptions {
    includeTags?: string[];
    includeAttrs?: string[];
    excludeTags?: string[];
    excludeAttrs?: string[];
    truncateText?: boolean;
    maxTextLength?: number;
}

interface CapturedPageSnapshotResult {
    rawContent: string;
    fenceLanguage: "yaml" | "html";
    notes: string[];
}

async function capturePageSnapshot(
    browser: WdioBrowser,
    options: CaptureSnapshotOptions = {},
): Promise<CapturedPageSnapshotResult | null> {
    try {
        const snapshotResult = await browser.unstable_captureDomSnapshot(options);

        const notes: string[] = [];

        const omittedParts: string[] = [];
        if (snapshotResult.omittedTags.length > 0) {
            omittedParts.push(`tags: ${snapshotResult.omittedTags.join(", ")}`);
        }
        if (snapshotResult.omittedAttributes.length > 0) {
            omittedParts.push(`attributes: ${snapshotResult.omittedAttributes.join(", ")}`);
        }

        if (omittedParts.length > 0) {
            notes.push(
                `${omittedParts.join(" and ")} were omitted from this browser snapshot. If you need them, request the browser snapshot again and explicitly specify them as needed.`,
            );
        }

        if (snapshotResult.textWasTruncated) {
            notes.push(
                `some text contents/attribute values were truncated. If you need full text contents, request a snapshot with truncateText: false.`,
            );
        }

        return {
            rawContent: snapshotResult.snapshot,
            fenceLanguage: "yaml",
            notes,
        };
    } catch (error) {
        console.error("Error getting browser snapshot:", error);

        if (browser.getPageSource) {
            try {
                const pageSource = await browser.getPageSource();
                return {
                    rawContent: pageSource,
                    fenceLanguage: "html",
                    notes: [
                        `failed to get optimized browser snapshot, below is raw page source as a fallback. The error was: ${(error as Error)?.stack}`,
                    ],
                };
            } catch (fallbackError) {
                console.error("Error getting page source fallback:", fallbackError);
            }
        }
    }

    return null;
}

function formatNotesAsComments(notes: string[], fenceLanguage: "yaml" | "html"): string {
    if (notes.length === 0) return "";

    if (fenceLanguage === "html") {
        return notes.map(note => `<!-- Note: ${note} -->`).join("\n") + "\n";
    }

    return (
        notes
            .map(note =>
                note
                    .split("\n")
                    .map((line, index) => (index === 0 ? `# Note: ${line}` : `#   ${line}`))
                    .join("\n"),
            )
            .join("\n") + "\n"
    );
}

export interface PageSnapshotResult {
    content: string;
    fenceLanguage: "yaml" | "html" | "diff";
}

export const INLINE_SNAPSHOT_MAX_LENGTH = 32_000;

export function isPageSnapshotTooLargeForInline(snapshot: PageSnapshotResult): boolean {
    return snapshot.content.length > INLINE_SNAPSHOT_MAX_LENGTH;
}

export async function getPageSnapshot(
    browser: WdioBrowser,
    options: CaptureSnapshotOptions = {},
): Promise<PageSnapshotResult | null> {
    const result = await capturePageSnapshot(browser, options);
    if (!result) return null;

    const noteBlock = formatNotesAsComments(result.notes, result.fenceLanguage);
    return {
        content: noteBlock + result.rawContent,
        fenceLanguage: result.fenceLanguage,
    };
}

export interface SavedPageSnapshot {
    filePath: string;
}

async function savePageSnapshotToFile(snapshot: PageSnapshotResult): Promise<SavedPageSnapshot> {
    const dir = path.join(os.tmpdir(), ".testplane", "snapshots");
    await fs.mkdir(dir, { recursive: true });

    const timestamp = formatTimestamp();
    const extension = snapshot.fenceLanguage === "html" ? "html" : snapshot.fenceLanguage === "diff" ? "diff" : "yml";
    const filePath = path.join(dir, `${timestamp}-${randomUUID()}.${extension}`);

    await fs.writeFile(filePath, snapshot.content, "utf8");

    return { filePath };
}

/** Format a snapshot as a response string, optionally saving it to a file if it is too large for inline display. */
export async function convertSnapshotToResponse(
    snapshot: PageSnapshotResult,
    { forceSaveToFile = false }: { forceSaveToFile?: boolean } = {},
): Promise<string> {
    if (forceSaveToFile) {
        const saved = await savePageSnapshotToFile(snapshot);
        return `The snapshot was saved to: ${saved.filePath}`;
    }

    if (!isPageSnapshotTooLargeForInline(snapshot)) {
        return "```" + snapshot.fenceLanguage + "\n" + snapshot.content + "\n```";
    }

    const saved = await savePageSnapshotToFile(snapshot);

    return `The snapshot is too large to include inline (${snapshot.content.length} characters; limit ${INLINE_SNAPSHOT_MAX_LENGTH}), so it was saved to: ${saved.filePath}`;
}
