import { z } from "zod";

export const TESTING_LIBRARY_QUERY_FIELDS = [
    "role",
    "text",
    "labelText",
    "placeholderText",
    "displayValue",
    "altText",
    "title",
    "testId",
] as const;

export type TestingLibraryQueryField = (typeof TESTING_LIBRARY_QUERY_FIELDS)[number];

export const QUERY_OPTION_FIELDS = ["name", "exact", "hidden", "level"] as const;
export type QueryOptionField = (typeof QUERY_OPTION_FIELDS)[number];

export const elementSelectorShape = {
    selector: z
        .string()
        .optional()
        .describe("CSS selector, XPath, or webdriverio locator. Mutually exclusive with testing-library query fields."),
    role: z.string().optional().describe('ARIA role for testing-library getByRole (e.g. "button", "heading", "link").'),
    text: z.string().optional().describe("Visible text content for testing-library getByText."),
    labelText: z
        .string()
        .optional()
        .describe("Label text associated with a form input for testing-library getByLabelText."),
    placeholderText: z.string().optional().describe("Input placeholder text for testing-library getByPlaceholderText."),
    displayValue: z.string().optional().describe("Current input display value for testing-library getByDisplayValue."),
    altText: z.string().optional().describe("Image alt attribute for testing-library getByAltText."),
    title: z.string().optional().describe("HTML title attribute for testing-library getByTitle."),
    testId: z.string().optional().describe("data-testid attribute for testing-library getByTestId."),

    name: z.string().optional().describe("Accessible name modifier (queryOptions.name) for role queries."),
    exact: z.boolean().optional().describe("Whether to match text exactly (queryOptions.exact)."),
    hidden: z
        .boolean()
        .optional()
        .describe("Include elements hidden from the accessibility tree (queryOptions.hidden)."),
    level: z.number().int().optional().describe("Heading level modifier for role='heading' (queryOptions.level), 1-6."),
};

export type ElementSelector = {
    selector?: string;
    role?: string;
    text?: string;
    labelText?: string;
    placeholderText?: string;
    displayValue?: string;
    altText?: string;
    title?: string;
    testId?: string;
    name?: string;
    exact?: boolean;
    hidden?: boolean;
    level?: number;
};
