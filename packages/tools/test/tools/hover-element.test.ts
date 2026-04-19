import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { hoverElement } from "../../src/tools/hover-element.js";
import { LocatorStrategy } from "../../src/schemas/element-selector.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/hoverElement",
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

        describe("hover functionality", () => {
            it("should hover an element using semantic query", async () => {
                const result = await hoverElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "role",
                            queryValue: "button",
                            queryOptions: { name: "Submit Form" },
                        },
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully hovered element");
                expect(text).toContain("button#submit-btn[@hover]");
            });

            it("should hover an element using CSS selector", async () => {
                const result = await hoverElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.Wdio,
                            selector: "#unique-element",
                        },
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully hovered element");
                expect(text).toContain("div#unique-element[@hover]");
            });

            it("should return correct testplane code for hovered element", async () => {
                const result = await hoverElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "role",
                            queryValue: "button",
                            queryOptions: { name: "Submit Form" },
                        },
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain('await (await browser.findByRole("button", {"name":"Submit Form"})).moveTo()');
            });
        });

        describe("error handling specific to hover", () => {
            it("should provide helpful error messages for hover failures", async () => {
                const result = await hoverElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "role",
                            queryValue: "button",
                            queryOptions: { name: "Non-existent Button" },
                        },
                    },
                    browser,
                );

                expect(result.isError).toBe(true);
                const text = getTextContent(result);
                expect(text).toContain("Element not found");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
