import { WdioBrowser } from "testplane";
import { setupBrowser } from "@testplane/testing-library";
import {
    ElementSelector,
    TESTING_LIBRARY_QUERY_FIELDS,
    TestingLibraryQueryField,
} from "../schemas/element-selector.js";

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

export type ElementSource =
    | { kind: "wdio"; selector: string }
    | {
          kind: "testing-library";
          field: TestingLibraryQueryField;
          value: string;
          options?: Record<string, unknown>;
      };

function pickQueryOptions(args: ElementSelector): Record<string, unknown> | undefined {
    const opts: Record<string, unknown> = {};
    if (args.name !== undefined) opts.name = args.name;
    if (args.exact !== undefined) opts.exact = args.exact;
    if (args.hidden !== undefined) opts.hidden = args.hidden;
    if (args.level !== undefined) opts.level = args.level;
    return Object.keys(opts).length > 0 ? opts : undefined;
}

export function detectElementSource(args: ElementSelector): ElementSource {
    const hasSelector = args.selector !== undefined;
    const tlFields = TESTING_LIBRARY_QUERY_FIELDS.filter(f => args[f] !== undefined);

    if (hasSelector && tlFields.length > 0) {
        throw new Error(
            `Provide either 'selector' or a testing-library query field (${TESTING_LIBRARY_QUERY_FIELDS.join(
                "/",
            )}), not both.`,
        );
    }
    if (tlFields.length > 1) {
        throw new Error(`Provide only one testing-library query field. Got: ${tlFields.join(", ")}.`);
    }
    if (!hasSelector && tlFields.length === 0) {
        throw new Error(
            `Provide a 'selector' or a testing-library query field (${TESTING_LIBRARY_QUERY_FIELDS.join("/")}).`,
        );
    }

    if (hasSelector) {
        return { kind: "wdio", selector: args.selector as string };
    }

    const field = tlFields[0];
    return {
        kind: "testing-library",
        field,
        value: args[field] as string,
        options: pickQueryOptions(args),
    };
}

export async function findElementByWdioSelector(browser: WdioBrowser, selector: string): Promise<ElementResult> {
    const element = await browser.$(selector);
    return {
        element,
        queryDescription: `CSS selector "${selector}"`,
        testplaneCode: `browser.$("${selector}")`,
    };
}

export async function findElementByTestingLibraryQuery(
    browser: WdioBrowser,
    field: TestingLibraryQueryField,
    value: string,
    options?: Record<string, unknown>,
): Promise<NullableElementResult> {
    const api = setupBrowser(browser as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const serializedOptions = options ? `, ${JSON.stringify(options)}` : "";
    let element: WebdriverIO.Element | null = null;
    let queryDescription = "";
    let testplaneCode = "";

    try {
        switch (field) {
            case "role":
                element = (await api.queryByRole(value, options as never)) as WebdriverIO.Element | null;
                queryDescription = `role "${value}"${options?.name ? ` with name "${options.name as string}"` : ""}`;
                testplaneCode = `await browser.findByRole("${value}"${serializedOptions})`;
                break;
            case "text":
                element = (await api.queryByText(value, options as never)) as WebdriverIO.Element | null;
                queryDescription = `text "${value}"`;
                testplaneCode = `await browser.findByText("${value}"${serializedOptions})`;
                break;
            case "labelText":
                element = (await api.queryByLabelText(value, options as never)) as WebdriverIO.Element | null;
                queryDescription = `label text "${value}"`;
                testplaneCode = `await browser.findByLabelText("${value}"${serializedOptions})`;
                break;
            case "placeholderText":
                element = (await api.queryByPlaceholderText(value, options as never)) as WebdriverIO.Element | null;
                queryDescription = `placeholder text "${value}"`;
                testplaneCode = `await browser.findByPlaceholderText("${value}"${serializedOptions})`;
                break;
            case "displayValue":
                element = (await api.queryByDisplayValue(value, options as never)) as WebdriverIO.Element | null;
                queryDescription = `display value "${value}"`;
                testplaneCode = `await browser.findByDisplayValue("${value}"${serializedOptions})`;
                break;
            case "altText":
                element = (await api.queryByAltText(value, options as never)) as WebdriverIO.Element | null;
                queryDescription = `alt text "${value}"`;
                testplaneCode = `await browser.findByAltText("${value}"${serializedOptions})`;
                break;
            case "title":
                element = (await api.queryByTitle(value, options as never)) as WebdriverIO.Element | null;
                queryDescription = `title "${value}"`;
                testplaneCode = `await browser.findByTitle("${value}"${serializedOptions})`;
                break;
            case "testId":
                element = (await api.queryByTestId(value, options as never)) as WebdriverIO.Element | null;
                queryDescription = `test ID "${value}"`;
                testplaneCode = `await browser.findByTestId("${value}"${serializedOptions})`;
                break;
        }
    } catch (e) {
        if (e instanceof Error && e.message.includes("Found multiple elements")) {
            throw new Error(e.message.split("\n")[0]);
        }
        throw e;
    }

    return { element, queryDescription, testplaneCode };
}

export async function findElement(browser: WdioBrowser, args: ElementSelector): Promise<ElementResult> {
    const source = detectElementSource(args);

    let result: ElementResult | NullableElementResult;
    if (source.kind === "wdio") {
        result = await findElementByWdioSelector(browser, source.selector);
    } else {
        result = await findElementByTestingLibraryQuery(browser, source.field, source.value, source.options);
    }

    if (!result.element) {
        throw new Error(`Unable to find element with ${result.queryDescription}`);
    }

    return result as ElementResult;
}
