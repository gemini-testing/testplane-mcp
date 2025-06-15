import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";

describe(
    "tools/closeTab",
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
        });

        afterEach(async () => {
            if (client) {
                await client.close();
            }
        });

        describe("closeTab tool availability", () => {
            it("should list closeTab tool in available tools", async () => {
                const tools = await client.listTools();

                const closeTabTool = tools.tools.find(tool => tool.name === "closeTab");

                expect(closeTabTool).toBeDefined();
            });
        });

        describe("closeTab tool error handling", () => {
            it("should return error when browser is not active", async () => {
                const result = await client.callTool({
                    name: "closeTab",
                    arguments: {},
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("browser is not launched yet");
            });

            it("should return error when trying to close the last remaining tab", async () => {
                await client.callTool({
                    name: "navigate",
                    arguments: { url: "https://example.com" },
                });

                const result = await client.callTool({
                    name: "closeTab",
                    arguments: {},
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Cannot close tab — this is the last remaining tab");
            });

            it("should handle invalid tab number parameter", async () => {
                try {
                    await client.callTool({
                        name: "closeTab",
                        arguments: { tabNumber: 0 },
                    });
                    expect.fail("Expected tab number 0 to fail");
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });
        });

        describe("closeTab tool execution with multiple tabs", () => {
            beforeEach(async () => {
                // Create 3 tabs for testing
                await client.callTool({
                    name: "navigate",
                    arguments: { url: "https://example.com" },
                });

                await client.callTool({
                    name: "openNewTab",
                    arguments: { url: playgroundUrl },
                });

                await client.callTool({
                    name: "openNewTab",
                    arguments: {},
                });
            });

            it("should handle tab number out of range", async () => {
                const result = await client.callTool({
                    name: "closeTab",
                    arguments: { tabNumber: 5 },
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("out of range");
                expect(content[0].text).toContain("Available range: 1-3");
            });

            it("should close current tab (tab 3) when no tabNumber provided", async () => {
                const result = await client.callTool({
                    name: "closeTab",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Closed tab 3: Untitled");

                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(2);
            });

            it("should close specific tab by number (tab 1)", async () => {
                const result = await client.callTool({
                    name: "closeTab",
                    arguments: { tabNumber: 1 },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Closed tab 1: Example Domain");
                expect(responseText).toContain("https://example.com");

                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(2);
                expect(responseText).toMatch(/Untitled.*\(current\)/);
            });

            it("should verify tab closure with listTabs", async () => {
                await client.callTool({
                    name: "closeTab",
                    arguments: { tabNumber: 1 },
                });

                const listResult = await client.callTool({
                    name: "listTabs",
                    arguments: {},
                });

                expect(listResult.isError).toBe(false);
                const content = listResult.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(2);
                expect(responseText).not.toContain("Example Domain");
                expect(responseText).toContain("Element Click Test Playground");
                expect(responseText).toContain("Untitled");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
