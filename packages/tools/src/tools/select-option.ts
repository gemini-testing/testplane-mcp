import { z } from "zod";
import { ActionTool, ToolArgs, ToolKind } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";
import { elementSelectorShape } from "../schemas/element-selector.js";
import { findElement } from "../utils/element-selector.js";

export const selectOptionSchema = {
    visibleText: z
        .string()
        .optional()
        .describe("Option visible text to select. Mutually exclusive with --index and --value."),
    index: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Zero-based option index to select. Mutually exclusive with --visible-text and --value."),
    value: z
        .string()
        .optional()
        .describe("Option value attribute to select. Mutually exclusive with --visible-text and --index."),
    ...elementSelectorShape,
};

type SelectSelection =
    | {
          kind: "visible text";
          value: string;
          methodCall: string;
      }
    | {
          kind: "index";
          value: number;
          methodCall: string;
      }
    | {
          kind: "value";
          value: string;
          methodCall: string;
      };

type SelectElement = WebdriverIO.Element & {
    selectByVisibleText(text: string | number): Promise<void>;
    selectByIndex(index: number): Promise<void>;
    selectByAttribute(attribute: string, value: string | number): Promise<void>;
};

function getSelection(args: ToolArgs<typeof selectOptionSchema>): SelectSelection {
    const provided = [
        args.visibleText !== undefined ? "visible text" : undefined,
        args.index !== undefined ? "index" : undefined,
        args.value !== undefined ? "value" : undefined,
    ].filter(Boolean);

    if (provided.length !== 1) {
        throw new Error("Provide exactly one option selector: --visible-text, --index, or --value.");
    }

    if (args.visibleText !== undefined) {
        return {
            kind: "visible text",
            value: args.visibleText,
            methodCall: `selectByVisibleText(${JSON.stringify(args.visibleText)})`,
        };
    }

    if (args.index !== undefined) {
        if (!Number.isInteger(args.index) || args.index < 0) {
            throw new Error("--index must be a non-negative integer.");
        }

        return {
            kind: "index",
            value: args.index,
            methodCall: `selectByIndex(${args.index})`,
        };
    }

    return {
        kind: "value",
        value: args.value as string,
        methodCall: `selectByAttribute("value", ${JSON.stringify(args.value as string)})`,
    };
}

function getSelectionDescription(selection: SelectSelection): string {
    if (selection.kind === "index") {
        return `index ${selection.value}`;
    }

    return `${selection.kind} ${JSON.stringify(selection.value)}`;
}

const selectOptionCb: ActionTool<typeof selectOptionSchema>["cb"] = async (args, browser) => {
    try {
        const selection = getSelection(args);
        const { element, queryDescription, testplaneCode } = await findElement(browser, args);
        const tagName = await element.getTagName();

        if (tagName.toLowerCase() !== "select") {
            throw new Error("Element is not a native <select>; this tool only works with native <select> elements.");
        }

        const selectElement = element as SelectElement;

        if (selection.kind === "visible text") {
            await selectElement.selectByVisibleText(selection.value);
        } else if (selection.kind === "index") {
            await selectElement.selectByIndex(selection.value);
        } else {
            await selectElement.selectByAttribute("value", selection.value);
        }

        console.error(
            `Successfully selected option by ${getSelectionDescription(selection)} in element with ${queryDescription}`,
        );

        return await createBrowserStateResponse(browser, {
            action: `Successfully selected option by ${getSelectionDescription(selection)} in <select> found by ${queryDescription}`,
            testplaneCode: testplaneCode.startsWith("await")
                ? `await (${testplaneCode}).${selection.methodCall};`
                : `await ${testplaneCode}.${selection.methodCall};`,
        });
    } catch (error) {
        console.error("Error selecting option:", error);

        if (
            error instanceof Error &&
            (error.message.includes("Unable to find") || error.message.includes("element wasn't found"))
        ) {
            return createErrorResponse(
                "Element not found. Try using a different query strategy or check if the element exists on the page.",
            );
        }

        if (
            error instanceof Error &&
            (error.message.includes("Provide exactly one option selector") ||
                error.message.includes("native <select>") ||
                error.message.includes("--index"))
        ) {
            return createErrorResponse(error.message);
        }

        return createErrorResponse("Error selecting option", error instanceof Error ? error : undefined);
    }
};

export const selectOption: ActionTool<typeof selectOptionSchema> = {
    kind: ToolKind.Action,
    name: "select",
    description: "Select an option in a native <select> element.",
    schema: selectOptionSchema,
    cb: selectOptionCb,
    cli: {
        positional: ["selector"],
        section: "Interaction",
        usage: "<selector/locator options> (--visible-text <text> | --index <n> | --value <value>)",
        examples: [
            'testplane-cli select "#country" --visible-text "Germany"',
            'testplane-cli select "#country" --value de',
            'testplane-cli select --label-text "Country" --index 2',
        ],
    },
};
