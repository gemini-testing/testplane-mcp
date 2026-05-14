import { z } from "zod";
import { ActionTool, ToolKind } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const openNewTabSchema = {
    url: z.string().url("Invalid URL format").optional().describe("Optional URL to navigate to in the new tab"),
};

const openNewTabCb: ActionTool<typeof openNewTabSchema>["cb"] = async (args, browser) => {
    try {
        const { url } = args;

        const windowHandles = await browser.getWindowHandles();
        const isFreshBlankTab =
            windowHandles.length === 1 && (await browser.getUrl()).match(/^(about:blank|data:,?)/i) !== null;

        let actionMessage = "Opened new tab";
        let testplaneCode = "// Open new tab\nawait browser.newWindow('about:blank');";

        if (isFreshBlankTab) {
            // Reuse the initial blank tab rather than leaving it behind.
            if (url) {
                await browser.url(url);
            }
        } else {
            await browser.newWindow(url ?? "about:blank");
        }

        if (url) {
            actionMessage = `Opened new tab and navigated to ${url}`;
            testplaneCode = `// Open new tab and navigate to URL\nawait browser.newWindow('${url}');`;
        }

        return await createBrowserStateResponse(browser, {
            action: actionMessage,
            testplaneCode,
        });
    } catch (error) {
        console.error("Error opening new tab:", error);
        return createErrorResponse("Error opening new tab", error instanceof Error ? error : undefined);
    }
};

export const openNewTab: ActionTool<typeof openNewTabSchema> = {
    kind: ToolKind.Action,
    name: "new-tab",
    description: "Open a new browser tab, optionally navigate to a URL, and automatically switch to it",
    supportedTransports: ["launch-browser"],
    schema: openNewTabSchema,
    cb: openNewTabCb,
    cli: { positional: ["url"], section: "Tabs" },
};
