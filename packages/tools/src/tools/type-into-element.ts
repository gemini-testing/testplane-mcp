import { z } from "zod";
import { ActionTool, ToolKind } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";
import { elementSelectorShape } from "../schemas/element-selector.js";
import { findElement } from "../utils/element-selector.js";

export const typeIntoElementSchema = {
    ...elementSelectorShape,
    value: z.string().describe("The text value to type into the element"),
};

const typeIntoElementCb: ActionTool<typeof typeIntoElementSchema>["cb"] = async (args, browser) => {
    try {
        const { value } = args;

        const { element, queryDescription, testplaneCode } = await findElement(browser, args);

        await element.setValue(value);

        console.error(`Successfully typed "${value}" into element with ${queryDescription}`);

        return await createBrowserStateResponse(browser, {
            action: `Successfully typed "${value}" into element found by ${queryDescription}`,
            testplaneCode: testplaneCode.startsWith("await")
                ? `await (${testplaneCode}).setValue("${value}");`
                : `await ${testplaneCode}.setValue("${value}");`,
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

export const typeIntoElement: ActionTool<typeof typeIntoElementSchema> = {
    kind: ToolKind.Action,
    name: "type",
    description: "Type text into an element on the page.",
    supportedTransports: ["launch-browser"],
    schema: typeIntoElementSchema,
    cb: typeIntoElementCb,
    cli: { positional: ["selector"], section: "Interaction" },
};
