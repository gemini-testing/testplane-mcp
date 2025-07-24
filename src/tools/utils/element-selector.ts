import { z } from "zod";
import { WdioBrowser } from "testplane";
import { setupBrowser } from "@testing-library/webdriverio";

export enum LocatorStrategy {
    Wdio = "webdriverio",
    TestingLibrary = "testing-library",
}

export const elementSelectorSchema = {
    locator: z.discriminatedUnion("strategy", [
        z.object({
            strategy: z.literal(LocatorStrategy.Wdio),
            selector: z.string().describe("CSS selector, XPath or WebdriverIO locator."),
        }),
        z.object({
            strategy: z.literal(LocatorStrategy.TestingLibrary),
            queryType: z
                .enum(["role", "text", "labelText", "placeholderText", "displayValue", "altText", "title", "testId"])
                .describe(
                    "Semantic query type (PREFERRED). Use this whenever possible for better accessibility and robustness.",
                ),
            queryValue: z
                .string()
                .describe(
                    "The value to search for with the specified queryType (e.g., 'button' for role, 'Submit' for text).",
                ),
            queryOptions: z
                .object({
                    name: z
                        .string()
                        .optional()
                        .describe("Accessible name for role queries (e.g., getByRole('button', {name: 'Submit'}))"),
                    exact: z.boolean().optional().describe("Whether to match exact text (default: true)"),
                    hidden: z
                        .boolean()
                        .optional()
                        .describe("Include elements hidden from accessibility tree (default: false)"),
                    level: z.number().optional().describe("Heading level for role='heading' (1-6)"),
                })
                .optional()
                .describe("Additional options for semantic queries"),
        }),
    ])
        .describe(`Element location strategy, an object, properties of which depend on the strategy. Available strategies: wdio or testing-library.

    - wdio strategy: CSS selectors, XPath expressions or wdio locators. Examples:
        - CSS selector: {"strategy": "wdio", "selector": "button.submit-btn"}
        - XPath: {"strategy": "wdio", "selector": "//button[text()='Submit']"}
        - wdio locator: {"strategy": "wdio", "selector": "button*=Submit"}

    - testing-library strategy: semantic queries like getByRole, getByText, getByTestId, etc. Examples:
        - {"strategy": "testing-library", "queryType": "role", "queryValue": "button", "queryOptions": {"name": "submit", "exact": false}}
        - {"strategy": "testing-library", "queryType": "text", "queryValue": "Submit"}
        - {"strategy": "testing-library", "queryType": "labelText", "queryValue": "Email"}
        - {"strategy": "testing-library", "queryType": "placeholderText", "queryValue": "Enter your name"}
        - {"strategy": "testing-library", "queryType": "displayValue", "queryValue": "123456"}
        - {"strategy": "testing-library", "queryType": "altText", "queryValue": "Submit"}
        - {"strategy": "testing-library", "queryType": "title", "queryValue": "Submit"}
        - {"strategy": "testing-library", "queryType": "testId", "queryValue": "submit-btn"}

Match user's code style - use testing-library queries if user asks to write tests and has testing-library installed.
`),
};

export type ElementSelectorArgs = z.infer<typeof elementSelectorSchema.locator>;

export interface ElementResult {
    element: WebdriverIO.Element;
    queryDescription: string;
    testplaneCode: string;
}

export interface NullableElementResult {
    element: WebdriverIO.Element | null;
    queryDescription: string;
    testplaneCode: string;
}

export async function findElementByWdioSelector(
    browser: WdioBrowser,
    locator: Extract<ElementSelectorArgs, { strategy: LocatorStrategy.Wdio }>,
): Promise<ElementResult> {
    const { selector } = locator;
    const element = await browser.$(selector);
    const queryDescription = `CSS selector "${selector}"`;
    const testplaneCode = `browser.$("${selector}")`;

    return {
        element,
        queryDescription,
        testplaneCode,
    };
}

export async function findElementByTestingLibraryQuery(
    browser: WdioBrowser,
    locator: Extract<ElementSelectorArgs, { strategy: LocatorStrategy.TestingLibrary }>,
): Promise<NullableElementResult> {
    const {
        queryByRole,
        queryByText,
        queryByLabelText,
        queryByPlaceholderText,
        queryByDisplayValue,
        queryByAltText,
        queryByTitle,
        queryByTestId,
    } = setupBrowser(browser as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const { queryType, queryValue, queryOptions } = locator;
    let element;
    let queryDescription = "";
    let testplaneCode = "";

    try {
        switch (queryType) {
            case "role":
                element = await queryByRole(queryValue, queryOptions);
                queryDescription = `role "${queryValue}"${queryOptions?.name ? ` with name "${queryOptions.name}"` : ""}`;
                testplaneCode = `await browser.findByRole("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""})`;
                break;
            case "text":
                element = await queryByText(queryValue, queryOptions);
                queryDescription = `text "${queryValue}"`;
                testplaneCode = `await browser.findByText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""})`;
                break;
            case "labelText":
                element = await queryByLabelText(queryValue, queryOptions);
                queryDescription = `label text "${queryValue}"`;
                testplaneCode = `await browser.findByLabelText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""})`;
                break;
            case "placeholderText":
                element = await queryByPlaceholderText(queryValue, queryOptions);
                queryDescription = `placeholder text "${queryValue}"`;
                testplaneCode = `await browser.findByPlaceholderText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""})`;
                break;
            case "displayValue":
                element = await queryByDisplayValue(queryValue, queryOptions);
                queryDescription = `display value "${queryValue}"`;
                testplaneCode = `await browser.findByDisplayValue("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""})`;
                break;
            case "altText":
                element = await queryByAltText(queryValue, queryOptions);
                queryDescription = `alt text "${queryValue}"`;
                testplaneCode = `await browser.findByAltText("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""})`;
                break;
            case "title":
                element = await queryByTitle(queryValue, queryOptions);
                queryDescription = `title "${queryValue}"`;
                testplaneCode = `await browser.findByTitle("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""})`;
                break;
            case "testId":
                element = await queryByTestId(queryValue, queryOptions);
                queryDescription = `test ID "${queryValue}"`;
                testplaneCode = `await browser.findByTestId("${queryValue}"${queryOptions ? `, ${JSON.stringify(queryOptions)}` : ""})`;
                break;
            default:
                throw new Error(`Unsupported queryType: ${queryType}`);
        }
    } catch (e) {
        if (e instanceof Error && e.message.includes("Found multiple elements")) {
            throw new Error(e.message.split("\n")[0]);
        }
        throw e;
    }

    return {
        element,
        queryDescription,
        testplaneCode,
    };
}

export async function findElement(browser: WdioBrowser, locator: ElementSelectorArgs): Promise<ElementResult> {
    let result;
    if (locator.strategy === LocatorStrategy.TestingLibrary) {
        result = await findElementByTestingLibraryQuery(browser, locator);
    } else if (locator.strategy === LocatorStrategy.Wdio) {
        result = await findElementByWdioSelector(browser, locator);
    } else {
        throw new Error(
            `Provided locator.strategy is not supported. Please pass either ${LocatorStrategy.Wdio} or ${LocatorStrategy.TestingLibrary} as locator.strategy.`,
        );
    }

    if (!result.element) {
        throw new Error(`Unable to find element with ${result.queryDescription}`);
    }

    return result as ElementResult;
}
