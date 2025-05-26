import { ToolDefinition } from "../types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextProvider } from "../context-provider.js";
import { createSimpleResponse, createErrorResponse } from "../responses/index.js";

export const closeBrowserSchema = {};

const closeBrowserCb: ToolCallback<typeof closeBrowserSchema> = async () => {
    try {
        const context = contextProvider.getContext();

        if (!context.browser.isActive()) {
            return createSimpleResponse("No active browser session to close");
        }

        console.error("Closing browser session...");
        await context.browser.close();

        return createSimpleResponse("Browser session closed successfully");
    } catch (error) {
        console.error("Error closing browser:", error);
        return createErrorResponse("Error closing browser", error instanceof Error ? error : undefined);
    }
};

export const closeBrowser: ToolDefinition<typeof closeBrowserSchema> = {
    name: "closeBrowser",
    description: "Close the current browser session",
    schema: closeBrowserSchema,
    cb: closeBrowserCb,
};
