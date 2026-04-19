import { z } from "zod";
import { ActionTool } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const navigateSchema = {
    url: z.string().url("Invalid URL format").describe("The URL to navigate to"),
};

const navigateCb: ActionTool<typeof navigateSchema>["cb"] = async (args, browser) => {
    try {
        const { url } = args;

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

export const navigate: ActionTool<typeof navigateSchema> = {
    name: "navigate",
    description: "Open a URL in the browser",
    schema: navigateSchema,
    cb: navigateCb,
    cli: { positional: ["url"] },
};
