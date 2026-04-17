import { z } from "zod";
import { ToolDefinition } from "../types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextProvider } from "../context-provider.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const openNewTabSchema = {
    url: z.string().url("Invalid URL format").optional().describe("Optional URL to navigate to in the new tab"),
};

const openNewTabCb: ToolCallback<typeof openNewTabSchema> = async args => {
    try {
        const { url } = args;
        const context = contextProvider.getContext();

        const browserWasActive = await context.browser.isActive();
        const browser = await context.browser.get();

        let actionMessage = "Opened new tab";
        let testplaneCode = "// Open new tab\nawait browser.newWindow('about:blank');";

        if (!browserWasActive) {
            // Browser wasn't active, so browser.get() already created the first tab
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

export const openNewTab: ToolDefinition<typeof openNewTabSchema> = {
    name: "openNewTab",
    description: "Open a new browser tab, optionally navigate to a URL, and automatically switch to it",
    schema: openNewTabSchema,
    cb: openNewTabCb,
};
