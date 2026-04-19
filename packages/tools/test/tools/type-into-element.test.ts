import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { typeIntoElement } from "../../src/tools/type-into-element.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/type",
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

        describe("typing functionality", () => {
            it("should successfully type text into an element using semantic query", async () => {
                const result = await typeIntoElement.cb(
                    {
                        labelText: "Email Address",
                        value: "test@example.com",
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain('Successfully typed "test@example.com" into element');
                // TODO: once page snapshots will have info about form values, we can check that the form value is updated
            });

            it("should successfully type text into element using CSS selector", async () => {
                const result = await typeIntoElement.cb(
                    {
                        selector: "#username",
                        value: "john_doe",
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain('Successfully typed "john_doe" into element');
                // TODO: once page snapshots will have info about form values, we can check that the form value is updated
            });

            it("should return correct testplane code for typed element", async () => {
                const result = await typeIntoElement.cb(
                    {
                        placeholderText: "Enter your name",
                        value: "John Smith",
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain(
                    'await (await browser.findByPlaceholderText("Enter your name")).setValue("John Smith")',
                );
            });
        });

        describe("error handling specific to typing", () => {
            it("should provide helpful error messages for element not found", async () => {
                const result = await typeIntoElement.cb(
                    {
                        labelText: "Non-existent Field",
                        value: "test",
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
