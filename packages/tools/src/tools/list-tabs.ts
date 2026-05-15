import { ActionTool, ToolKind } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const listTabsSchema = {};

const listTabsCb: ActionTool<typeof listTabsSchema>["cb"] = async (_args, browser) => {
    try {
        return await createBrowserStateResponse(browser, {
            action: "Retrieved list of browser tabs",
            isSnapshotNeeded: false,
        });
    } catch (error) {
        console.error("Error listing browser tabs:", error);
        return createErrorResponse("Error listing browser tabs", error instanceof Error ? error : undefined);
    }
};

export const listTabs: ActionTool<typeof listTabsSchema> = {
    kind: ToolKind.Action,
    name: "list-tabs",
    description: "Get a list of all currently opened browser tabs with their URLs, titles, and active status",
    schema: listTabsSchema,
    cb: listTabsCb,
    cli: { section: "Tabs" },
};
