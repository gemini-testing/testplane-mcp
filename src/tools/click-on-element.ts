import { z } from "zod";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setupBrowser } from "@testing-library/webdriverio";
import { ToolDefinition } from "../types.js";
import { contextProvider } from "../context-provider.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const elementClickSchema = {
    queryType: z
        .enum(["role", "text", "labelText", "placeholderText", "displayValue", "altText", "title", "testId"])
        .optional()
        .describe(
            "Semantic query type (PREFERRED). Use this whenever possible for better accessibility and robustness.",
        ),

    queryValue: z
        .string()
        .optional()
        .describe("The value to search for with the specified queryType (e.g., 'button' for role, 'Submit' for text)."),

    queryOptions: z
        .object({
            name: z
                .string()
                .optional()
                .describe("Accessible name for role queries (e.g., getByRole('button', {name: 'Submit'}))"),
            exact: z.boolean().optional().describe("Whether to match exact text (default: true)"),
            hidden: z.boolean().optional().describe("Include elements hidden from accessibility tree (default: false)"),
            level: z.number().optional().describe("Heading level for role='heading' (1-6)"),
        })
        .optional()
        .describe("Additional options for semantic queries"),

    selector: z
        .string()
        .optional()
        .describe("CSS selector or XPath. Use only when semantic queries cannot locate the element."),
};

const clickOnElementCb: ToolCallback<typeof elementClickSchema> = async args => {
    try {
        const { queryType, queryValue, queryOptions, selector } = args;

        const hasSemanticQuery = queryType && queryValue;
        const hasSelector = selector;

        if (!hasSemanticQuery && !hasSelector) {
            throw new Error("Provide either semantic query (queryType + queryValue) or selector");
        }

        if (hasSemanticQuery && hasSelector) {
            throw new Error(
                "Provide EITHER semantic query (queryType + queryValue) OR selector, not both. Prefer semantic queries for better accessibility.",
            );
        }

        const context = contextProvider.getContext();
        const browser = await context.browser.get();

        let element;
        let testplaneCode = "";
        let queryDescription = "";

        if (queryType && queryValue) {
            const {
                getByRole,
                getByText,
                getByLabelText,
                getByPlaceholderText,
                getByDisplayValue,
                getByAltText,
                getByTitle,
                getByTestId,
            } = setupBrowser(browser as any); // eslint-disable-line @typescript-eslint/no-explicit-any

            switch (queryType) {
                case "role":
                    element = await getByRole(queryValue, queryOptions);
                    queryDescription = `role "${queryValue}"${queryOptions?.name ? ` with name "${queryOptions.name}"` : ""}`;
                    testplaneCode = `const element = await browser.getByRole("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\nawait element.click();`;
                    break;
                case "text":
                    element = await getByText(queryValue, queryOptions);
                    queryDescription = `text "${queryValue}"`;
                    testplaneCode = `const element = await browser.getByText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\nawait element.click();`;
                    break;
                case "labelText":
                    element = await getByLabelText(queryValue, queryOptions);
                    queryDescription = `label text "${queryValue}"`;
                    testplaneCode = `const element = await browser.getByLabelText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\nawait element.click();`;
                    break;
                case "placeholderText":
                    element = await getByPlaceholderText(queryValue, queryOptions);
                    queryDescription = `placeholder text "${queryValue}"`;
                    testplaneCode = `const element = await browser.getByPlaceholderText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\nawait element.click();`;
                    break;
                case "displayValue":
                    element = await getByDisplayValue(queryValue, queryOptions);
                    queryDescription = `display value "${queryValue}"`;
                    testplaneCode = `const element = await browser.getByDisplayValue("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\nawait element.click();`;
                    break;
                case "altText":
                    element = await getByAltText(queryValue, queryOptions);
                    queryDescription = `alt text "${queryValue}"`;
                    testplaneCode = `const element = await browser.getByAltText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\nawait element.click();`;
                    break;
                case "title":
                    element = await getByTitle(queryValue, queryOptions);
                    queryDescription = `title "${queryValue}"`;
                    testplaneCode = `const element = await browser.getByTitle("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\nawait element.click();`;
                    break;
                case "testId":
                    element = await getByTestId(queryValue, queryOptions);
                    queryDescription = `test ID "${queryValue}"`;
                    testplaneCode = `const element = await browser.getByTestId("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\nawait element.click();`;
                    break;
                default:
                    throw new Error(`Unsupported queryType: ${queryType}`);
            }
            testplaneCode += `\nIMPORTANT for AI agents: if user asks to write tests, prefer to use semantic queries over CSS selectors, if user tests also use testing-library queries.`;
        } else if (selector) {
            element = await browser.$(selector);
            queryDescription = `CSS selector "${selector}"`;
            testplaneCode = `const element = await browser.$("${selector}");\nawait element.click();`;
        } else {
            throw new Error("No valid element selection method provided");
        }

        if (!element) {
            throw new Error("Element not found");
        }

        await element.click();

        console.error(`Successfully clicked element with ${queryDescription}`);

        return await createBrowserStateResponse(browser, {
            action: `Successfully clicked element found by ${queryDescription}`,
            testplaneCode,
            additionalInfo: `Element selection strategy: ${queryType ? `Semantic query (${queryType})` : "CSS selector (fallback)"}`,
        });
    } catch (error) {
        console.error("Error clicking element:", error);
        let errorMessage = "Error clicking element";

        if (error instanceof Error && error.message.includes("Unable to find")) {
            errorMessage =
                "Element not found. Try using a different query strategy or check if the element exists on the page.";
        }

        return createErrorResponse(errorMessage, error instanceof Error ? error : undefined);
    }
};

export const clickOnElement: ToolDefinition<typeof elementClickSchema> = {
    name: "clickOnElement",
    description: `Click an element on the page. 

PREFERRED APPROACH (for AI agents): Use semantic queries (queryType + queryValue) which are more robust and accessibility-focused:
- queryType="role" + queryValue="button" + queryOptions.name="Submit" → finds submit button
- queryType="text" + queryValue="Click here" → finds element containing that text
- queryType="labelText" + queryValue="Email" → finds input with Email label

FALLBACK APPROACH: Use selector only when semantic queries cannot locate the element:
- selector="button.submit-btn" → CSS selector
- selector="//button[text()='Submit']" → XPath

AI agents should prioritize semantic queries for better accessibility and test maintainability.`,
    schema: elementClickSchema,
    cb: clickOnElementCb,
};
