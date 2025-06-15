import { ToolDefinition } from "../types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextProvider } from "../context-provider.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const listTabsSchema = {};

const listTabsCb: ToolCallback<typeof listTabsSchema> = async () => {
    try {
        const context = contextProvider.getContext();

        if (!context.browser.isActive()) {
            return createErrorResponse(
                "No opened tabs — browser is not launched yet. Try opening a tab or navigating to URL.",
            );
        }

        const browser = await context.browser.get();

        return await createBrowserStateResponse(browser, {
            action: "Retrieved list of browser tabs",
            isSnapshotNeeded: false,
        });
    } catch (error) {
        console.error("Error listing browser tabs:", error);
        return createErrorResponse("Error listing browser tabs", error instanceof Error ? error : undefined);
    }
};

export const listTabs: ToolDefinition<typeof listTabsSchema> = {
    name: "listTabs",
    description: "Get a list of all currently opened browser tabs with their URLs, titles, and active status",
    schema: listTabsSchema,
    cb: listTabsCb,
};
