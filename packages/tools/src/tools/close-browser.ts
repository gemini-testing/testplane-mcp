import { SessionCloseTool } from "../types.js";
import { createSimpleResponse, createErrorResponse } from "../responses/index.js";

export const closeBrowserSchema = {};

const closeBrowserCb: SessionCloseTool<typeof closeBrowserSchema>["cb"] = async (_args, browser) => {
    try {
        if (!browser) {
            return createSimpleResponse("No active browser session to close");
        }

        console.error("Closing browser session...");
        try {
            await browser.deleteSession();
            console.error("Browser session closed");
        } catch (error) {
            console.error("Error closing browser session:", error);
        }

        return createSimpleResponse("Browser session closed successfully");
    } catch (error) {
        console.error("Error closing browser:", error);
        return createErrorResponse("Error closing browser", error instanceof Error ? error : undefined);
    }
};

export const closeBrowser: SessionCloseTool<typeof closeBrowserSchema> = {
    name: "closeBrowser",
    description: "Close the current browser session",
    schema: closeBrowserSchema,
    cb: closeBrowserCb,
};
