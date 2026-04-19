import { WdioBrowser } from "testplane";
import { setupBrowser } from "@testing-library/webdriverio";
import { ElementSelectorArgs, LocatorStrategy } from "../schemas/element-selector.js";

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
