import { z } from "zod";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "../types.js";
import { contextProvider } from "../context-provider.js";
import { createElementStateResponse, createErrorResponse } from "../responses/index.js";
import { elementSelectorSchema, findElement } from "./utils/element-selector.js";

export const typeIntoElementSchema = {
    ...elementSelectorSchema,
    text: z.string().describe("The text to type into the element"),
};

const typeIntoElementCb: ToolCallback<typeof typeIntoElementSchema> = async args => {
    try {
        const { text, ...selectorArgs } = args;

        const context = contextProvider.getContext();
        const browser = await context.browser.get();

        const { element, queryDescription, testplaneCode } = await findElement(
            browser,
            selectorArgs,
            `await element.setValue("${text}");`,
        );

        await element.setValue(text);

        console.error(`Successfully typed "${text}" into element with ${queryDescription}`);

        return await createElementStateResponse(element, {
            action: `Successfully typed "${text}" into element found by ${queryDescription}`,
            testplaneCode,
            additionalInfo: `Element selection strategy: ${selectorArgs.queryType ? `Semantic query (${selectorArgs.queryType})` : "CSS selector (fallback)"}`,
        });
    } catch (error) {
        console.error("Error typing into element:", error);

        if (error instanceof Error && error.message.includes("Unable to find")) {
            return createErrorResponse(
                "Element not found. Try using a different query strategy or check if the element exists on the page.",
            );
        }

        return createErrorResponse("Error typing into element", error instanceof Error ? error : undefined);
    }
};

export const typeIntoElement: ToolDefinition<typeof typeIntoElementSchema> = {
    name: "typeIntoElement",
    description: `Type text into an element on the page. The API is very similar to clickOnElement for consistency.

PREFERRED APPROACH (for AI agents): Use semantic queries (queryType + queryValue) which are more robust and accessibility-focused:
- queryType="role" + queryValue="textbox" + queryOptions.name="Email" → finds email input
- queryType="labelText" + queryValue="Password" → finds input with Password label
- queryType="placeholderText" + queryValue="Enter your name" → finds input with specific placeholder

FALLBACK APPROACH: Use selector only when semantic queries cannot locate the element:
- selector="input[name='email']" → CSS selector
- selector="//input[@placeholder='Search...']" → XPath

AI agents should prioritize semantic queries for better accessibility and test maintainability.`,
    schema: typeIntoElementSchema,
    cb: typeIntoElementCb,
};
