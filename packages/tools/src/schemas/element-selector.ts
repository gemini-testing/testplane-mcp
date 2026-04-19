import { z } from "zod";

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
