import { ActionTool } from "../types.js";
import { createElementStateResponse, createErrorResponse } from "../responses/index.js";
import { elementSelectorShape } from "../schemas/element-selector.js";
import { findElement } from "../utils/element-selector.js";

export const elementHoverSchema = { ...elementSelectorShape };

const hoverElementCb: ActionTool<typeof elementHoverSchema>["cb"] = async (args, browser) => {
    try {
        const { element, queryDescription, testplaneCode } = await findElement(browser, args);

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

export const hoverElement: ActionTool<typeof elementHoverSchema> = {
    name: "hover",
    description: "Hover an element on the page.",
    schema: elementHoverSchema,
    cb: hoverElementCb,
    cli: { positional: ["selector"] },
};
