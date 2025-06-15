import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";

describe(
    "tools/switchToTab",
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

        describe("switchToTab tool availability", () => {
            it("should list switchToTab tool in available tools", async () => {
                const tools = await client.listTools();

                const switchToTabTool = tools.tools.find(tool => tool.name === "switchToTab");

                expect(switchToTabTool).toBeDefined();
            });
        });

        describe("switchToTab tool error handling", () => {
            it("should return error when browser is not active", async () => {
                const result = await client.callTool({
                    name: "switchToTab",
                    arguments: { tabNumber: 1 },
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("browser is not launched yet");
            });

            it("should handle invalid tab number parameter", async () => {
                try {
                    await client.callTool({
                        name: "switchToTab",
                        arguments: { tabNumber: 0 },
                    });
                    expect.fail("Expected tab number 0 to fail");
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });
        });

        describe("switchToTab tool execution with multiple tabs", () => {
            beforeEach(async () => {
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
                    name: "switchToTab",
                    arguments: { tabNumber: 5 },
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("out of range");
                expect(content[0].text).toContain("Available range: 1-3");
            });

            it("should switch to tab 2 (Playground)", async () => {
                const result = await client.callTool({
                    name: "switchToTab",
                    arguments: { tabNumber: 2 },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Switched to tab 2: Element Click Test Playground");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toMatch(/Element Click Test Playground.*\(current\)/);
            });

            it("should detect when already on the requested tab", async () => {
                const result = await client.callTool({
                    name: "switchToTab",
                    arguments: { tabNumber: 3 },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Already on tab 3");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toMatch(/Untitled.*\(current\)/);
            });

            it("should verify tab switch with listTabs", async () => {
                await client.callTool({
                    name: "switchToTab",
                    arguments: { tabNumber: 1 },
                });

                const listResult = await client.callTool({
                    name: "listTabs",
                    arguments: {},
                });

                expect(listResult.isError).toBe(false);
                const content = listResult.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toMatch(/1\. Title: Example Domain.*\(current\)/);
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
