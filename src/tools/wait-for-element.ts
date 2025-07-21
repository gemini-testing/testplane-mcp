import { z } from "zod";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "../types.js";
import { contextProvider } from "../context-provider.js";
import { createSimpleResponse, createErrorResponse, createBrowserStateResponse } from "../responses/index.js";
import {
    elementSelectorSchema,
    findElementByTestingLibraryQuery,
    findElementByWdioSelector,
    LocatorStrategy,
} from "./utils/element-selector.js";

export const waitForElementSchema = {
    ...elementSelectorSchema,
    disappear: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to wait for element to disappear. Default: false (wait for element to appear)"),
    timeout: z.number().optional().default(3000).describe("Maximum time to wait in milliseconds. Default: 3000"),
    includeSnapshotInResponse: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to include page snapshot in response. Default: true"),
};

const waitForElementCb: ToolCallback<typeof waitForElementSchema> = async args => {
    try {
        const context = contextProvider.getContext();
        const browser = await context.browser.get();

        const { disappear = false, timeout, includeSnapshotInResponse = true } = args;

        const waitOptions: { reverse?: boolean; timeout?: number } = { reverse: disappear };

        if (timeout !== undefined) {
            waitOptions.timeout = timeout;
        }

        const actionDescription = disappear ? "disappear" : "appear";
        let queryDescription = "";
        let testplaneCode = "";

        if (args.locator.strategy === LocatorStrategy.Wdio) {
            const result = await findElementByWdioSelector(browser, args.locator);

            await result.element.waitForDisplayed(waitOptions);

            console.error(`Element with ${result.queryDescription} ${actionDescription} successfully`);

            queryDescription = result.queryDescription;
            testplaneCode = `await ${result.testplaneCode}.waitForDisplayed(${Object.keys(waitOptions).length > 0 ? JSON.stringify(waitOptions) : ""});`;
        } else if (args.locator.strategy === LocatorStrategy.TestingLibrary) {
            const testingLibraryLocator = args.locator;

            await browser.waitUntil(
                async () => {
                    const result = await findElementByTestingLibraryQuery(browser, testingLibraryLocator);
                    queryDescription = result.queryDescription;

                    return (await result.element?.isDisplayed()) === !disappear;
                },
                { timeoutMsg: `Timeout waiting for element to ${actionDescription}`, ...waitOptions },
            );

            console.error(`Element with ${queryDescription} ${actionDescription} successfully`);
            const queryName = `queryBy${testingLibraryLocator.queryType.charAt(0).toUpperCase() + testingLibraryLocator.queryType.slice(1)}`;
            testplaneCode = `await browser.waitUntil(async () => {
    const result = await browser.${queryName}("${testingLibraryLocator.queryValue}"${testingLibraryLocator.queryOptions ? `, ${JSON.stringify(testingLibraryLocator.queryOptions)}` : ""});
    return await result.isDisplayed() === ${!disappear};
}, ${waitOptions.timeout ? `{ timeout: ${waitOptions.timeout} }` : ""});`;
        }
        const successMessage = `Successfully waited for element found by ${queryDescription} to ${actionDescription}`;

        if (includeSnapshotInResponse) {
            return await createBrowserStateResponse(browser, {
                action: successMessage,
                testplaneCode,
            });
        } else {
            return createSimpleResponse(
                `✅ ${successMessage}\n\n## Testplane Code\n\`\`\`javascript\n${testplaneCode}\n\`\`\``,
            );
        }
    } catch (error) {
        console.error("Error waiting for element:", error);

        if (error instanceof Error && error.message.includes("Unable to find")) {
            return createErrorResponse(
                "Element not found. Try using a different query strategy or check if the element exists on the page.",
            );
        }

        if (
            error instanceof Error &&
            (error.message.includes("timeout") ||
                error.message.includes("still not displayed") ||
                error.message.includes("still displayed"))
        ) {
            const actionDescription = args.disappear ? "disappear" : "appear";
            return createErrorResponse(
                `Timeout waiting for element to ${actionDescription}. Consider increasing the timeout value or checking if the element behavior is as expected.`,
            );
        }

        return createErrorResponse("Error waiting for element", error instanceof Error ? error : undefined);
    }
};

export const waitForElement: ToolDefinition<typeof waitForElementSchema> = {
    name: "waitForElement",
    description: `Wait for an element to appear or disappear on the page. Useful for waiting until page loads fully or loading spinners disappear.`,
    schema: waitForElementSchema,
    cb: waitForElementCb,
};
