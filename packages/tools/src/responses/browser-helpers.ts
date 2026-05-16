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
    fenceLanguage: "yaml" | "html";
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

export async function savePageSnapshotToFile(
    browser: WdioBrowser,
    options: CaptureSnapshotOptions = {},
): Promise<SavedPageSnapshot | null> {
    const result = await getPageSnapshot(browser, options);
    if (!result) return null;

    const dir = path.join(os.tmpdir(), ".testplane", "snapshots");
    await fs.mkdir(dir, { recursive: true });

    const timestamp = formatTimestamp();
    const extension = result.fenceLanguage === "html" ? "html" : "yml";
    const filePath = path.join(dir, `${timestamp}-${randomUUID()}.${extension}`);

    await fs.writeFile(filePath, result.content, "utf8");

    return { filePath };
}
