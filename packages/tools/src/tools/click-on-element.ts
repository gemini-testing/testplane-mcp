import { ActionTool, ToolKind } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";
import { elementSelectorShape } from "../schemas/element-selector.js";
import { findElement } from "../utils/element-selector.js";

export const elementClickSchema = { ...elementSelectorShape };

const clickOnElementCb: ActionTool<typeof elementClickSchema>["cb"] = async (args, browser) => {
    try {
        const { element, queryDescription, testplaneCode } = await findElement(browser, args);

        await element.click();

        console.error(`Successfully clicked element with ${queryDescription}`);

        return await createBrowserStateResponse(browser, {
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

export const clickOnElement: ActionTool<typeof elementClickSchema> = {
    kind: ToolKind.Action,
    name: "click",
    description: "Click an element on the page.",
    schema: elementClickSchema,
    cb: clickOnElementCb,
    cli: { positional: ["selector"], section: "Interaction" },
};
