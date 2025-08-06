import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "../types.js";
import { contextProvider } from "../context-provider.js";
import { createElementStateResponse, createErrorResponse } from "../responses/index.js";
import { elementSelectorSchema, findElement } from "./utils/element-selector.js";

export const elementHoverSchema = elementSelectorSchema;

const hoverElementCb: ToolCallback<typeof elementHoverSchema> = async args => {
    try {
        const context = contextProvider.getContext();
        const browser = await context.browser.get();

        const { element, queryDescription, testplaneCode } = await findElement(browser, args.locator);

        await element.moveTo();

        console.error(`Successfully hovered element with ${queryDescription}`);

        return await createElementStateResponse(element, {
            action: `Successfully hovered element found by ${queryDescription}`,
            testplaneCode: testplaneCode.startsWith("await")
                ? `await (${testplaneCode}).moveTo();`
                : `await ${testplaneCode}.moveTo();`,
        });
    } catch (error) {
        console.error("Error hover element:", error);

        if (error instanceof Error && error.message.includes("Unable to find")) {
            return createErrorResponse(
                "Element not found. Try using a different query strategy or check if the element exists on the page.",
            );
        }

        return createErrorResponse("Error hover element", error instanceof Error ? error : undefined);
    }
};

export const hoverElement: ToolDefinition<typeof elementHoverSchema> = {
    name: "hoverElement",
    description: "Hover an element on the page.",
    schema: elementHoverSchema,
    cb: hoverElementCb,
};
