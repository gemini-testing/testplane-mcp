import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { waitForElement } from "../../src/tools/wait-for-element.js";
import { LocatorStrategy } from "../../src/schemas/element-selector.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";
import { navigate } from "../../src/tools/navigate.js";

describe(
    "tools/waitForElement",
    () => {
        let browser: WdioBrowser;
        let slowLoadingUrl: string;
        let testServer: PlaygroundServer;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            const baseUrl = await testServer.start();
            slowLoadingUrl = `${baseUrl}/slow-loading.html`;
            browser = await launchHeadlessBrowser();
        }, 20000);

        afterAll(async () => {
            if (browser) await browser.deleteSession();
            if (testServer) await testServer.stop();
        });

        let navigateResponse: string;

        beforeEach(async () => {
            const navigateResult = await navigate.cb({ url: slowLoadingUrl }, browser);
            navigateResponse = getTextContent(navigateResult);
        });

        describe("waiting for elements to appear", () => {
            it("should handle already visible elements", async () => {
                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "immediate-btn",
                        },
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully waited for element");
                expect(text).toContain("[data-testid=immediate-btn]");
            });

            it("should wait for content to appear using CSS selector", async () => {
                expect(navigateResponse).not.toContain("[data-testid=medium-btn]");

                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.Wdio,
                            selector: "#medium-button",
                        },
                        timeout: 5000,
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully waited for element");
                expect(text).toContain("to appear");
                expect(text).toContain("#medium-button");
            });

            it("should wait for content to appear using testing-library testId query", async () => {
                expect(navigateResponse).not.toContain("[data-testid=medium-btn]");

                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "medium-btn",
                        },
                        timeout: 5000,
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully waited for element");
                expect(text).toContain("to appear");
                expect(text).toContain('await browser.queryByTestId("medium-btn")');
                expect(text).toContain("[data-testid=medium-btn]");
            });
        });

        describe("waiting for elements to disappear", () => {
            it("should wait for disappearing content using CSS selector", async () => {
                expect(navigateResponse).toContain("[data-testid=disappearing-btn]");

                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.Wdio,
                            selector: "#disappearing-content",
                        },
                        disappear: true,
                        timeout: 5000,
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully waited for element");
                expect(text).toContain("to disappear");
                expect(text).not.toContain("[data-testid=disappearing-btn]");
            });

            it("should wait for disappearing content using testId", async () => {
                expect(navigateResponse).toContain("[data-testid=disappearing-btn]");

                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "disappearing-btn",
                        },
                        disappear: true,
                        timeout: 5000,
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully waited for element");
                expect(text).toContain("to disappear");
                expect(text).toContain('await browser.queryByTestId("disappearing-btn")');
                expect(text).not.toContain("[data-testid=disappearing-btn]");
            });

            it("should wait for text content to disappear", async () => {
                expect(navigateResponse).toContain('p "This content will disappear after 3 seconds');

                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "text",
                            queryValue: "This content will disappear after 3 seconds",
                            queryOptions: { exact: false },
                        },
                        disappear: true,
                        timeout: 5000,
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully waited for element");
                expect(text).toContain("to disappear");
                expect(text).toContain(
                    'await browser.queryByText("This content will disappear after 3 seconds", {"exact":false})',
                );
                expect(text).toContain('p[@hidden] "This content will disappear after 3 seconds');
            });
        });

        describe("timeout behavior", () => {
            it("should respect custom timeout values for appearing elements when using wdio selector", async () => {
                const startTime = Date.now();

                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.Wdio,
                            selector: "#never-appears",
                        },
                        disappear: false,
                        timeout: 1500,
                    },
                    browser,
                );

                const elapsedTime = Date.now() - startTime;

                expect(result.isError).toBe(true);
                const text = getTextContent(result);
                expect(text).toContain("Timeout waiting for element to appear");

                expect(elapsedTime).toBeGreaterThan(1400);
                expect(elapsedTime).toBeLessThan(2500);
            });

            it("should respect custom timeout values for appearing elements when using testing-library query", async () => {
                const startTime = Date.now();

                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "never-appears",
                        },
                        disappear: false,
                        timeout: 1500,
                    },
                    browser,
                );

                const elapsedTime = Date.now() - startTime;

                expect(result.isError).toBe(true);
                const text = getTextContent(result);
                expect(text).toContain("Timeout waiting for element to appear");

                expect(elapsedTime).toBeGreaterThan(1400);
                expect(elapsedTime).toBeLessThan(2500);
            });

            it("should handle timeout when waiting for element to disappear", async () => {
                const startTime = Date.now();

                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "immediate-btn",
                        },
                        disappear: true,
                        timeout: 1000,
                    },
                    browser,
                );

                const elapsedTime = Date.now() - startTime;

                expect(result.isError).toBe(true);
                const text = getTextContent(result);
                expect(text).toContain("Timeout waiting for element to disappear");

                expect(elapsedTime).toBeGreaterThan(900);
                expect(elapsedTime).toBeLessThan(1500);
            });
        });

        describe("configuration options", () => {
            it("should not include page snapshot when includeSnapshotInResponse is false", async () => {
                const result = await waitForElement.cb(
                    {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "immediate-btn",
                        },
                        disappear: false,
                        timeout: 1000,
                        includeSnapshotInResponse: false,
                    },
                    browser,
                );

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain("Successfully waited for element");

                expect(text).not.toContain("Current Tab Snapshot");
                expect(text).not.toContain("```yaml");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
