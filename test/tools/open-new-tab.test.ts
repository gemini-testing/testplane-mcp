import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";

describe(
    "tools/openNewTab",
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

        describe("openNewTab tool availability", () => {
            it("should list openNewTab tool in available tools", async () => {
                const tools = await client.listTools();

                const openNewTabTool = tools.tools.find(tool => tool.name === "openNewTab");

                expect(openNewTabTool).toBeDefined();
            });
        });

        describe("openNewTab tool execution when browser is not active", () => {
            it("should launch browser with blank tab when no URL provided", async () => {
                const result = await client.callTool({
                    name: "openNewTab",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Opened new tab");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("1. Title: Untitled");
                expect(responseText).toContain("data:, (current)");

                // Should have exactly one tab
                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(1);
            });

            it("should launch browser and navigate to URL when URL provided", async () => {
                const result = await client.callTool({
                    name: "openNewTab",
                    arguments: { url: playgroundUrl },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Opened new tab and navigated to");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("1. Title: Element Click Test Playground");
                expect(responseText).toContain("(current)");

                // Should have exactly one tab
                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(1);
            });
        });

        describe("openNewTab tool execution when browser is active", () => {
            beforeEach(async () => {
                await client.callTool({
                    name: "navigate",
                    arguments: { url: "https://example.com" },
                });
            });

            it("should add new blank tab to existing tabs", async () => {
                const result = await client.callTool({
                    name: "openNewTab",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Opened new tab");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("1. Title: Example Domain");
                expect(responseText).toContain("2. Title: Untitled");
                expect(responseText).toContain("about:blank (current)");

                // Should have exactly two tabs
                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(2);
            });

            it("should add new tab with URL to existing tabs", async () => {
                const result = await client.callTool({
                    name: "openNewTab",
                    arguments: { url: playgroundUrl },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Opened new tab and navigated to");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("1. Title: Example Domain");
                expect(responseText).toContain("2. Title: Element Click Test Playground");
                expect(responseText).toContain("(current)");

                // Should have exactly two tabs
                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(2);

                expect(responseText).toMatch(/Element Click Test Playground.*\(current\)/);
            });
        });

        describe("openNewTab tool error handling", () => {
            it("should handle invalid URL parameter", async () => {
                try {
                    await client.callTool({
                        name: "openNewTab",
                        arguments: { url: "not-a-valid-url" },
                    });
                    expect.fail("Expected invalid URL to fail");
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
