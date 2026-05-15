import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";
import { LocatorStrategy } from "../../src/tools/utils/element-selector";

describe(
    "tools/waitForElement",
    () => {
        let client: Client;
        let slowLoadingUrl: string;
        let testServer: PlaygroundServer;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            const baseUrl = await testServer.start();
            slowLoadingUrl = `${baseUrl}/slow-loading.html`;
        }, 20000);

        afterAll(async () => {
            if (testServer) {
                await testServer.stop();
            }
        });

        let navigateResponse: string;

        beforeEach(async () => {
            client = await startClient();
            const navigateResult = await client.callTool({ name: "navigate", arguments: { url: slowLoadingUrl } });
            navigateResponse = (navigateResult.content as Array<{ type: string; text: string }>)[0].text;
        });

        afterEach(async () => {
            if (client) {
                await client.close();
            }
        });

        describe("tool availability", () => {
            it("should list waitForElement tool in available tools", async () => {
                const tools = await client.listTools();

                const waitForElementTool = tools.tools.find(tool => tool.name === "waitForElement");

                expect(waitForElementTool).toBeDefined();
            });
        });

        describe("waiting for elements to appear", () => {
            it("should handle already visible elements", async () => {
                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "immediate-btn",
                        },
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Successfully waited for element");
                expect(content[0].text).toContain("[data-testid=immediate-btn]");
            });

            it("should wait for content to appear using CSS selector", async () => {
                expect(navigateResponse).not.toContain("[data-testid=medium-btn]");

                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.Wdio,
                            selector: "#medium-button",
                        },
                        timeout: 5000,
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Successfully waited for element");
                expect(content[0].text).toContain("to appear");
                expect(content[0].text).toContain("#medium-button");
            });

            it("should wait for content to appear using testing-library testId query", async () => {
                expect(navigateResponse).not.toContain("[data-testid=medium-btn]");

                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "medium-btn",
                        },
                        timeout: 5000,
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Successfully waited for element");
                expect(content[0].text).toContain("to appear");
                expect(content[0].text).toContain('await browser.queryByTestId("medium-btn")');
                expect(content[0].text).toContain("[data-testid=medium-btn]");
            });
        });

        describe("waiting for elements to disappear", () => {
            it("should wait for disappearing content using CSS selector", async () => {
                expect(navigateResponse).toContain("[data-testid=disappearing-btn]");

                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.Wdio,
                            selector: "#disappearing-content",
                        },
                        disappear: true,
                        timeout: 5000,
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Successfully waited for element");
                expect(content[0].text).toContain("to disappear");
                expect(content[0].text).not.toContain("[data-testid=disappearing-btn]");
            });

            it("should wait for disappearing content using testId", async () => {
                expect(navigateResponse).toContain("[data-testid=disappearing-btn]");

                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "disappearing-btn",
                        },
                        disappear: true,
                        timeout: 5000,
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Successfully waited for element");
                expect(content[0].text).toContain("to disappear");
                expect(content[0].text).toContain('await browser.queryByTestId("disappearing-btn")');
                expect(content[0].text).not.toContain("[data-testid=disappearing-btn]");
            });

            it("should wait for text content to disappear", async () => {
                expect(navigateResponse).toContain('p "This content will disappear after 3 seconds');

                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "text",
                            queryValue: "This content will disappear after 3 seconds",
                            queryOptions: { exact: false },
                        },
                        disappear: true,
                        timeout: 5000,
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Successfully waited for element");
                expect(content[0].text).toContain("to disappear");
                expect(content[0].text).toContain(
                    'await browser.queryByText("This content will disappear after 3 seconds", {"exact":false})',
                );
                expect(content[0].text).toContain('p[@hidden] "This content will disappear after 3 seconds');
            });
        });

        describe("timeout behavior", () => {
            it("should respect custom timeout values for appearing elements when using wdio selector", async () => {
                const startTime = Date.now();

                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.Wdio,
                            selector: "#never-appears",
                        },
                        disappear: false,
                        timeout: 1500,
                    },
                });

                const elapsedTime = Date.now() - startTime;

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Timeout waiting for element to appear");

                expect(elapsedTime).toBeGreaterThan(1400);
                expect(elapsedTime).toBeLessThan(2500);
            });

            it("should respect custom timeout values for appearing elements when using testing-library query", async () => {
                const startTime = Date.now();

                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "never-appears",
                        },
                        disappear: false,
                        timeout: 1500,
                    },
                });

                const elapsedTime = Date.now() - startTime;

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Timeout waiting for element to appear");

                expect(elapsedTime).toBeGreaterThan(1400);
                expect(elapsedTime).toBeLessThan(2500);
            });

            it("should handle timeout when waiting for element to disappear", async () => {
                const startTime = Date.now();

                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "immediate-btn",
                        },
                        disappear: true,
                        timeout: 1000,
                    },
                });

                const elapsedTime = Date.now() - startTime;

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Timeout waiting for element to disappear");

                expect(elapsedTime).toBeGreaterThan(900);
                expect(elapsedTime).toBeLessThan(1500);
            });
        });

        describe("configuration options", () => {
            it("should not include page snapshot when includeSnapshotInResponse is false", async () => {
                const result = await client.callTool({
                    name: "waitForElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "testId",
                            queryValue: "immediate-btn",
                        },
                        disappear: false,
                        timeout: 1000,
                        includeSnapshotInResponse: false,
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Successfully waited for element");

                expect(content[0].text).not.toContain("Current Tab Snapshot");
                expect(content[0].text).not.toContain("```yaml");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
