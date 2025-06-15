import { WdioBrowser } from "testplane";

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

async function captureSnapshot(
    browserOrElement: WebdriverIO.Element | WdioBrowser,
    options: CaptureSnapshotOptions = {},
    context: { type: "browser" | "element"; fallbackMethod?: string },
): Promise<string | null> {
    try {
        const snapshotResult = await (browserOrElement as WdioBrowser).unstable_captureDomSnapshot(options);

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
                `# Note: ${omittedParts.join(" and ")} were omitted from this ${context.type} snapshot. If you need them, request the ${context.type} snapshot again and explicitly specify them as needed.`,
            );
        }

        if (snapshotResult.textWasTruncated) {
            notes.push(
                `# Note: some text contents/attribute values were truncated. If you need full text contents, request a snapshot with truncateText: false.`,
            );
        }

        return "```yaml\n" + notes.join("\n") + "\n" + snapshotResult.snapshot + "\n```";
    } catch (error) {
        console.error(`Error getting ${context.type} snapshot:`, error);

        if (context.type === "browser" && browserOrElement.getPageSource) {
            const pageSource = await browserOrElement.getPageSource();
            return (
                "```html\n" +
                `<!-- Note: failed to get optimized ${context.type} snapshot, below is raw page source as a fallback. The error was: ${(error as Error)?.stack} -->\n\n` +
                pageSource +
                "\n```"
            );
        }

        if (context.type === "element" && (browserOrElement as WebdriverIO.Element).getHTML) {
            const elementHTML = await (browserOrElement as WebdriverIO.Element).getHTML();
            return (
                "```html\n" +
                `<!-- Note: failed to get ${context.type} snapshot, below is element HTML as a fallback. The error was: ${(error as Error)?.message} -->\n\n` +
                elementHTML +
                "\n```"
            );
        }
    }

    return null;
}

export async function getCurrentTabSnapshot(
    browser: WdioBrowser,
    options: CaptureSnapshotOptions = {},
): Promise<string | null> {
    return captureSnapshot(browser, options, { type: "browser" });
}

export async function getElementSnapshot(
    element: WebdriverIO.Element,
    options: CaptureSnapshotOptions = {},
): Promise<string | null> {
    return captureSnapshot(element, options, { type: "element" });
}
