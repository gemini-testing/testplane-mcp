import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { selectOption } from "../../src/tools/select-option.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/select",
    () => {
        let browser: WdioBrowser;
        let playgroundUrl: string;
        let testServer: PlaygroundServer;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
            browser = await launchHeadlessBrowser();
        }, 20000);

        afterAll(async () => {
            if (browser) await browser.deleteSession();
            if (testServer) await testServer.stop();
        });

        beforeEach(async () => {
            await browser.url(playgroundUrl);
        });

        async function getCountryValue(): Promise<string> {
            const select = await browser.$("#country");
            return select.getValue();
        }

        describe("selection functionality", () => {
            it("should select an option by visible text using CSS selector", async () => {
                const result = await selectOption.cb(
                    {
                        selector: "#country",
                        visibleText: "Germany",
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                expect(await getCountryValue()).toBe("de");
                const text = getTextContent(result);
                expect(text).toContain('Successfully selected option by visible text "Germany"');
                expect(text).toContain('await browser.$("#country").selectByVisibleText("Germany")');
            });

            it("should select an option by index using semantic query", async () => {
                const result = await selectOption.cb(
                    {
                        labelText: "Country",
                        index: 2,
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                expect(await getCountryValue()).toBe("de");
                const text = getTextContent(result);
                expect(text).toContain("Successfully selected option by index 2");
                expect(text).toContain('await (await browser.findByLabelText("Country")).selectByIndex(2)');
            });

            it("should select an option by value attribute using semantic query", async () => {
                const result = await selectOption.cb(
                    {
                        role: "combobox",
                        name: "Country",
                        value: "jp",
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                expect(await getCountryValue()).toBe("jp");
                const text = getTextContent(result);
                expect(text).toContain('Successfully selected option by value "jp"');
                expect(text).toContain('selectByAttribute("value", "jp")');
            });
        });

        describe("error handling", () => {
            it("should require exactly one option selector", async () => {
                const result = await selectOption.cb(
                    {
                        selector: "#country",
                    },
                    browser,
                );

                expect(result.isError).toBe(true);
                expect(getTextContent(result)).toContain("Provide exactly one option selector");
            });

            it("should reject non-select elements", async () => {
                const result = await selectOption.cb(
                    {
                        selector: "#submit-btn",
                        value: "anything",
                    },
                    browser,
                );

                expect(result.isError).toBe(true);
                expect(getTextContent(result)).toContain("native <select>");
            });

            it("should provide helpful error messages for element not found", async () => {
                const result = await selectOption.cb(
                    {
                        selector: "#missing-select",
                        value: "anything",
                    },
                    browser,
                );

                expect(result.isError).toBe(true);
                expect(getTextContent(result)).toContain("Element not found");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
