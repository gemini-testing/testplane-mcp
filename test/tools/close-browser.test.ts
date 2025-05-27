import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";

describe(
    "tools/closeBrowser",
    () => {
        let client: Client;

        beforeEach(async () => {
            client = await startClient();
        });

        afterEach(async () => {
            if (client) {
                await client.close();
            }
        });

        describe("closeBrowser tool availability", () => {
            it("should list closeBrowser tool in available tools", async () => {
                const tools = await client.listTools();

                const closeBrowserTool = tools.tools.find(tool => tool.name === "closeBrowser");

                expect(closeBrowserTool).toBeDefined();
                expect(closeBrowserTool?.description).toBe("Close the current browser session");
                expect(closeBrowserTool?.inputSchema.properties).toEqual({});
            });
        });

        describe("closeBrowser tool execution", () => {
            it("should close an active browser session", async () => {
                await client.callTool({
                    name: "navigate",
                    arguments: { url: "https://example.com" },
                });

                const result = await client.callTool({
                    name: "closeBrowser",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");
                expect(content[0].text).toBe("Browser session closed successfully");
            });

            it("should handle closing when no browser session is active", async () => {
                const result = await client.callTool({
                    name: "closeBrowser",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");
                expect(content[0].text).toBe("No active browser session to close");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
