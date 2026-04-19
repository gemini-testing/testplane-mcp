import { z } from "zod";
import { ActionTool } from "../types.js";
import { createElementStateResponse, createErrorResponse } from "../responses/index.js";
import { elementSelectorSchema } from "../schemas/element-selector.js";
import { findElement } from "../utils/element-selector.js";

export const typeIntoElementSchema = {
    ...elementSelectorSchema,
    text: z.string().describe("The text to type into the element"),
};

const typeIntoElementCb: ActionTool<typeof typeIntoElementSchema>["cb"] = async (args, browser) => {
    try {
        const { text } = args;

        const { element, queryDescription, testplaneCode } = await findElement(browser, args.locator);

        await element.setValue(text);

        console.error(`Successfully typed "${text}" into element with ${queryDescription}`);

        return await createElementStateResponse(element, {
            action: `Successfully typed "${text}" into element found by ${queryDescription}`,
            testplaneCode: testplaneCode.startsWith("await")
                ? `await (${testplaneCode}).setValue("${text}");`
                : `await ${testplaneCode}.setValue("${text}");`,
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
    name: "type",
    description: "Type text into an element on the page.",
    schema: typeIntoElementSchema,
    cb: typeIntoElementCb,
};
