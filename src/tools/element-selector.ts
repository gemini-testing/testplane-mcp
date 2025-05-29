import { z } from "zod";
import { setupBrowser } from "@testing-library/webdriverio";

export const elementSelectorSchema = {
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

export interface ElementSelectorArgs {
    queryType?: "role" | "text" | "labelText" | "placeholderText" | "displayValue" | "altText" | "title" | "testId";
    queryValue?: string;
    queryOptions?: {
        name?: string;
        exact?: boolean;
        hidden?: boolean;
        level?: number;
    };
    selector?: string;
}

export interface ElementResult {
    element: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    queryDescription: string;
    testplaneCode: string;
}

export async function findElement(
    browser: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    args: ElementSelectorArgs,
    actionType: "click" | "setValue",
): Promise<ElementResult> {
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

        const actionCode = actionType === "click" ? "await element.click();" : "await element.setValue(text);";

        switch (queryType) {
            case "role":
                element = await getByRole(queryValue, queryOptions);
                queryDescription = `role "${queryValue}"${queryOptions?.name ? ` with name "${queryOptions.name}"` : ""}`;
                testplaneCode = `const element = await browser.getByRole("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\n${actionCode}`;
                break;
            case "text":
                element = await getByText(queryValue, queryOptions);
                queryDescription = `text "${queryValue}"`;
                testplaneCode = `const element = await browser.getByText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\n${actionCode}`;
                break;
            case "labelText":
                element = await getByLabelText(queryValue, queryOptions);
                queryDescription = `label text "${queryValue}"`;
                testplaneCode = `const element = await browser.getByLabelText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\n${actionCode}`;
                break;
            case "placeholderText":
                element = await getByPlaceholderText(queryValue, queryOptions);
                queryDescription = `placeholder text "${queryValue}"`;
                testplaneCode = `const element = await browser.getByPlaceholderText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\n${actionCode}`;
                break;
            case "displayValue":
                element = await getByDisplayValue(queryValue, queryOptions);
                queryDescription = `display value "${queryValue}"`;
                testplaneCode = `const element = await browser.getByDisplayValue("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\n${actionCode}`;
                break;
            case "altText":
                element = await getByAltText(queryValue, queryOptions);
                queryDescription = `alt text "${queryValue}"`;
                testplaneCode = `const element = await browser.getByAltText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\n${actionCode}`;
                break;
            case "title":
                element = await getByTitle(queryValue, queryOptions);
                queryDescription = `title "${queryValue}"`;
                testplaneCode = `const element = await browser.getByTitle("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\n${actionCode}`;
                break;
            case "testId":
                element = await getByTestId(queryValue, queryOptions);
                queryDescription = `test ID "${queryValue}"`;
                testplaneCode = `const element = await browser.getByTestId("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""});\n${actionCode}`;
                break;
            default:
                throw new Error(`Unsupported queryType: ${queryType}`);
        }
        testplaneCode += `\nIMPORTANT for AI agents: if user asks to write tests, prefer to use semantic queries over CSS selectors, if user tests also use testing-library queries.`;
    } else if (selector) {
        element = await browser.$(selector);
        queryDescription = `CSS selector "${selector}"`;
        const actionCode = actionType === "click" ? "await element.click();" : "await element.setValue(text);";
        testplaneCode = `const element = await browser.$("${selector}");\n${actionCode}`;
    } else {
        throw new Error("No valid element selection method provided");
    }

    if (!element) {
        throw new Error("Element not found");
    }

    return {
        element,
        queryDescription,
        testplaneCode,
    };
}
