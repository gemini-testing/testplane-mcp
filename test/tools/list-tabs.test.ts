import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";

describe(
    "tools/listTabs",
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

        describe("listTabs tool availability", () => {
            it("should list listTabs tool in available tools", async () => {
                const tools = await client.listTools();

                const listTabsTool = tools.tools.find(tool => tool.name === "listTabs");

                expect(listTabsTool).toBeDefined();
            });
        });

        describe("listTabs tool execution", () => {
            it("should return no opened tabs when browser is not active", async () => {
                const result = await client.callTool({
                    name: "listTabs",
                    arguments: {},
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("browser is not launched yet");
            });

            it("should list tabs when browser is active with single tab", async () => {
                // Navigate to create the first tab
                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                const result = await client.callTool({
                    name: "listTabs",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Retrieved list of browser tabs");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("Element Click Test Playground");
                expect(responseText).toContain("(current)");
            });

            it("should list multiple tabs with correct numbering and active indicator", async () => {
                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                await client.callTool({
                    name: "openNewTab",
                    arguments: { url: "https://example.com" },
                });

                await client.callTool({
                    name: "openNewTab",
                    arguments: {},
                });

                const result = await client.callTool({
                    name: "listTabs",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Retrieved list of browser tabs");
                expect(responseText).toContain("## Browser Tabs");

                expect(responseText).toContain("1. Title: Element Click Test Playground");
                expect(responseText).toContain("2. Title: Example Domain");
                expect(responseText).toContain("3. Title: Untitled");

                const currentMatches = responseText.match(/about:blank \(current\)/g);
                expect(currentMatches).toHaveLength(1);
            });

            it("should not include snapshot in response", async () => {
                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                const result = await client.callTool({
                    name: "listTabs",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).not.toContain("## Current Tab Snapshot");
                expect(responseText).not.toContain("## Testplane Code");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
