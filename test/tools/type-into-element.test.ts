import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";
import { LocatorStrategy } from "../../src/tools/utils/element-selector";

describe(
    "tools/typeIntoElement",
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
            it("should list typeIntoElement tool in available tools", async () => {
                const tools = await client.listTools();

                const typeIntoElementTool = tools.tools.find(tool => tool.name === "typeIntoElement");

                expect(typeIntoElementTool).toBeDefined();
            });
        });

        describe("typing functionality", () => {
            it("should successfully type text into an element using semantic query", async () => {
                const result = await client.callTool({
                    name: "typeIntoElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "labelText",
                            queryValue: "Email Address",
                        },
                        text: "test@example.com",
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;

                expect(content[0].text).toContain('Successfully typed "test@example.com" into element');
                // TODO: once page snapshots will have info about form values, we can check that the form value is updated
            });

            it("should successfully type text into element using CSS selector", async () => {
                const result = await client.callTool({
                    name: "typeIntoElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.Wdio,
                            selector: "#username",
                        },
                        text: "john_doe",
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain('Successfully typed "john_doe" into element');
                // TODO: once page snapshots will have info about form values, we can check that the form value is updated
            });

            it("should return correct testplane code for typed element", async () => {
                const result = await client.callTool({
                    name: "typeIntoElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "placeholderText",
                            queryValue: "Enter your name",
                        },
                        text: "John Smith",
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain(
                    'await (await browser.findByPlaceholderText("Enter your name")).setValue("John Smith")',
                );
            });
        });

        describe("error handling specific to typing", () => {
            it("should provide helpful error messages for element not found", async () => {
                const result = await client.callTool({
                    name: "typeIntoElement",
                    arguments: {
                        locator: {
                            strategy: LocatorStrategy.TestingLibrary,
                            queryType: "labelText",
                            queryValue: "Non-existent Field",
                        },
                        text: "test",
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
