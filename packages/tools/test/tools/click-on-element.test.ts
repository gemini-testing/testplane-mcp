import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { clickOnElement } from "../../src/tools/click-on-element.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/click",
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

        describe("clicking functionality", () => {
            it("should click an element using semantic query", async () => {
                const result = await clickOnElement.cb(
                    {
                        role: "button",
                        name: "Submit Form",
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully clicked element");
                expect(text).toContain("span.clicked-indicator.show");
            });

            it("should click an element using CSS selector", async () => {
                const result = await clickOnElement.cb(
                    {
                        selector: "#unique-element",
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully clicked element");
                expect(text).toContain("span.clicked-indicator.show");
            });

            it("should return correct testplane code for clicked element", async () => {
                const result = await clickOnElement.cb(
                    {
                        role: "button",
                        name: "Submit Form",
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain('await (await browser.findByRole("button", {"name":"Submit Form"})).click()');
            });
        });

        describe("error handling specific to clicking", () => {
            it("should provide helpful error messages for clicking failures", async () => {
                const result = await clickOnElement.cb(
                    {
                        role: "button",
                        name: "Non-existent Button",
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
