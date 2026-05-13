import { z } from "zod";
import { ActionTool, ToolKind } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const navigateSchema = {
    url: z.string().url("Invalid URL format").describe("The URL to navigate to"),
    timeout: z.number().optional().describe("Maximum time to wait in milliseconds. Default: 30000"),
};

const navigateCb: ActionTool<typeof navigateSchema>["cb"] = async (args, browser) => {
    try {
        const { url, timeout } = args;

        const openOptions: { timeout?: number; ignoreNetworkErrorsPatterns: RegExp[] } = {
            ignoreNetworkErrorsPatterns: [/.*/],
        };
        const testplaneOpenOptions: { timeout?: number } = {};

        if (timeout !== undefined) {
            const browserConfig = await browser.getConfig();
            browserConfig.urlHttpTimeout = timeout;

            openOptions.timeout = timeout;
            testplaneOpenOptions.timeout = timeout;
        }

        console.error(`Navigating to: ${url}`);
        await browser.openAndWait(url, openOptions);

        const optionsCode =
            Object.keys(testplaneOpenOptions).length > 0 ? `, ${JSON.stringify(testplaneOpenOptions)}` : "";

        return await createBrowserStateResponse(browser, {
            action: `Successfully navigated to ${url}`,
            testplaneCode: `await browser.openAndWait("${url}"${optionsCode});`,
        });
    } catch (error) {
        console.error("Error navigating to URL:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (/timeout|timed out/i.test(errorMessage)) {
            return createErrorResponse(
                `Failed to load ${args.url} in ${args.timeout}ms. You can increase the wait time by setting a higher timeout value when calling this tool.\n\nOriginal error`,
                error instanceof Error ? error : undefined,
            );
        }

        return createErrorResponse(`Error navigating to ${args.url}`, error instanceof Error ? error : undefined);
    }
};

export const navigate: ActionTool<typeof navigateSchema> = {
    kind: ToolKind.Action,
    autoLaunchBrowser: true,
    name: "navigate",
    description: "Open a URL in the browser",
    schema: navigateSchema,
    cb: navigateCb,
    cli: { positional: ["url"], section: "Navigation" },
};
