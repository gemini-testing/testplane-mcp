import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";
import { LocatorStrategy } from "../../src/tools/utils/element-selector";

describe(
    "tools/hoverElement",
    () => {
        let client: Client;
        let playgroundUrl: string;
        let testServer: PlaygroundServer;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
        }, 20000);

        afterAll(async () => {
            if (testServer) {
                await testServer.stop();
            }
        });

        beforeEach(async () => {
            client = await startClient();
            await client.callTool({ name: "navigate", arguments: { url: playgroundUrl } });
        });

        afterEach(async () => {
            if (client) {
                await client.close();
            }
        });

        describe("tool availability", () => {
            it("should list hoverElement tool in available tools", async () => {
                const tools = await client.listTools();

                const elementHoverTool = tools.tools.find(tool => tool.name === "hoverElement");

                expect(elementHoverTool).toBeDefined();
            });
        });

        describe("hover functionality", () => {
            it("should hover an element using semantic query", async () => {
                const result = await client.callTool({
                    name: "hoverElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "role",
                            queryValue: "button",
                            queryOptions: { name: "Submit Form" },
                        },
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Successfully hovered element");
                expect(content[0].text).toContain("button#submit-btn[@hover]");
            });

            it("should hover an element using CSS selector", async () => {
                const result = await client.callTool({
                    name: "hoverElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.Wdio,
                            selector: "#unique-element",
                        },
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Successfully hovered element");
                expect(content[0].text).toContain("div#unique-element[@hover]");
            });

            it("should return correct testplane code for hovered element", async () => {
                const result = await client.callTool({
                    name: "hoverElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "role",
                            queryValue: "button",
                            queryOptions: { name: "Submit Form" },
                        },
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain(
                    'await (await browser.findByRole("button", {"name":"Submit Form"})).moveTo()',
                );
            });
        });

        describe("error handling specific to hover", () => {
            it("should provide helpful error messages for hover failures", async () => {
                const result = await client.callTool({
                    name: "hoverElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "role",
                            queryValue: "button",
                            queryOptions: { name: "Non-existent Button" },
                        },
                    },
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Element not found");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
