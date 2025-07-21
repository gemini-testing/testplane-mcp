import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "../types.js";
import { contextProvider } from "../context-provider.js";
import { createElementStateResponse, createErrorResponse } from "../responses/index.js";
import { elementSelectorSchema, findElement } from "./utils/element-selector.js";

export const elementClickSchema = elementSelectorSchema;

const clickOnElementCb: ToolCallback<typeof elementClickSchema> = async args => {
    try {
        const context = contextProvider.getContext();
        const browser = await context.browser.get();

        const { element, queryDescription, testplaneCode } = await findElement(browser, args.locator);

        await element.click();

        console.error(`Successfully clicked element with ${queryDescription}`);

        return await createElementStateResponse(element, {
            action: `Successfully clicked element found by ${queryDescription}`,
            testplaneCode: testplaneCode.startsWith("await")
                ? `await (${testplaneCode}).click();`
                : `await ${testplaneCode}.click();`,
        });
    } catch (error) {
        console.error("Error clicking element:", error);

        if (error instanceof Error && error.message.includes("Unable to find")) {
            return createErrorResponse(
                "Element not found. Try using a different query strategy or check if the element exists on the page.",
            );
        }

        return createErrorResponse("Error clicking element", error instanceof Error ? error : undefined);
    }
};

export const clickOnElement: ToolDefinition<typeof elementClickSchema> = {
    name: "clickOnElement",
    description: "Click an element on the page.",
    schema: elementClickSchema,
    cb: clickOnElementCb,
};
