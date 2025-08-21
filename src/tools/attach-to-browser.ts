import { Context, ToolDefinition } from "../types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSimpleResponse, createErrorResponse } from "../responses/index.js";
import { BrowserContext } from "../browser-context.js";
import type { SessionOptions } from "testplane";
import { contextProvider } from "../context-provider.js";
import { attachToBrowserSchema } from "./utils/attach-to-browser-schema.js";

const attachToBrowserCb: ToolCallback<typeof attachToBrowserSchema> = async args => {
    try {
        const { session } = args;

        const browserContext = new BrowserContext({}, session as SessionOptions);
        await browserContext.get();

        contextProvider.setContext({
            browser: browserContext,
        } as Context);

        const context = contextProvider.getContext();

        if (!(await context.browser.isActive())) {
            return createErrorResponse("Can not attach to browser using existing session options");
        }

        return createSimpleResponse("Successfully attached to existing browser session");
    } catch (error) {
        console.error("Error attach to browser:", error);
        return createErrorResponse("Error attach to browser", error instanceof Error ? error : undefined);
    }
};

export const attachToBrowser: ToolDefinition<typeof attachToBrowserSchema> = {
    name: "attachToBrowser",
    description: "Attach to existing browser session",
    schema: attachToBrowserSchema,
    cb: attachToBrowserCb,
};
