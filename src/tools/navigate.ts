import { z } from "zod";
import { ToolDefinition } from "../types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextProvider } from "../context-provider.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const navigateSchema = {
    url: z.string().url("Invalid URL format").describe("The URL to navigate to"),
};

const navigateCb: ToolCallback<typeof navigateSchema> = async args => {
    try {
        const { url } = args;
        const context = contextProvider.getContext();

        const browser = await context.browser.get();

        console.error(`Navigating to: ${url}`);
        await browser.openAndWait(url);

        return await createBrowserStateResponse(browser, {
            action: `Successfully navigated to ${url}`,
            testplaneCode: `await browser.openAndWait("${url}");`,
        });
    } catch (error) {
        console.error("Error navigating to URL:", error);
        return createErrorResponse("Error navigating to URL", error instanceof Error ? error : undefined);
    }
};

export const navigate: ToolDefinition<typeof navigateSchema> = {
    name: "navigate",
    description: "Open a URL in the browser",
    schema: navigateSchema,
    cb: navigateCb,
};
