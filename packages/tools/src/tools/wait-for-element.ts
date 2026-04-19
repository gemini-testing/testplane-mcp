import { z } from "zod";
import { ActionTool } from "../types.js";
import { createSimpleResponse, createErrorResponse, createBrowserStateResponse } from "../responses/index.js";
import { elementSelectorShape, TESTING_LIBRARY_QUERY_FIELDS } from "../schemas/element-selector.js";
import {
    detectElementSource,
    findElementByTestingLibraryQuery,
    findElementByWdioSelector,
} from "../utils/element-selector.js";

export const waitForElementSchema = {
    ...elementSelectorShape,
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

function describeSelectorArgs(args: {
    selector?: string;
    role?: string;
    text?: string;
    labelText?: string;
    placeholderText?: string;
    displayValue?: string;
    altText?: string;
    title?: string;
    testId?: string;
}): string {
    const picked: Record<string, unknown> = {};
    if (args.selector !== undefined) picked.selector = args.selector;
    for (const field of TESTING_LIBRARY_QUERY_FIELDS) {
        if (args[field] !== undefined) picked[field] = args[field];
    }
    return JSON.stringify(picked, null, 2);
}

const waitForElementCb: ActionTool<typeof waitForElementSchema>["cb"] = async (args, browser) => {
    try {
        const { disappear = false, timeout, includeSnapshotInResponse = true } = args;

        const waitOptions: { reverse?: boolean; timeout?: number } = { reverse: disappear };

        if (timeout !== undefined) {
            waitOptions.timeout = timeout;
        }

        const actionDescription = disappear ? "disappear" : "appear";
        const source = detectElementSource(args);
        let queryDescription = "";
        let testplaneCode = "";

        if (source.kind === "wdio") {
            const result = await findElementByWdioSelector(browser, source.selector);

            await result.element.waitForDisplayed(waitOptions);

            console.error(`Element with ${result.queryDescription} ${actionDescription}ed successfully`);

            queryDescription = result.queryDescription;
            testplaneCode = `await ${result.testplaneCode}.waitForDisplayed(${Object.keys(waitOptions).length > 0 ? JSON.stringify(waitOptions) : ""});`;
        } else {
            const { field, value, options } = source;

            await browser.waitUntil(
                async () => {
                    const result = await findElementByTestingLibraryQuery(browser, field, value, options);
                    queryDescription = result.queryDescription;

                    return (await result.element?.isDisplayed()) === !disappear;
                },
                { timeoutMsg: `Timeout waiting for element to ${actionDescription}`, ...waitOptions },
            );

            console.error(`Element with ${queryDescription} ${actionDescription}ed successfully`);
            const queryName = `queryBy${field.charAt(0).toUpperCase() + field.slice(1)}`;
            testplaneCode = `await browser.waitUntil(async () => {
    const result = await browser.${queryName}("${value}"${options ? `, ${JSON.stringify(options)}` : ""});
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
                `Element not found by provided selector:\n${describeSelectorArgs(args)}.\nTry using a different query strategy or check if the element exists on the page.`,
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

        return createErrorResponse(
            `Error waiting for element with selector:\n${describeSelectorArgs(args)}.\nError message: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }
};

export const waitForElement: ActionTool<typeof waitForElementSchema> = {
    name: "wait",
    description: `Wait for an element to appear or disappear on the page. Useful for waiting until page loads fully or loading spinners disappear.`,
    schema: waitForElementSchema,
    cb: waitForElementCb,
};
