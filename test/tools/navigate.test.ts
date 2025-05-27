import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startClient } from "../utils";

describe("tools/navigate", () => {
    let client: Client;

    beforeEach(async () => {
        client = await startClient();
    });

    afterEach(async () => {
        if (client) {
            await client.close();
        }
    });

    describe("navigate tool availability", () => {
        it("should list navigate tool in available tools", async () => {
            const tools = await client.listTools();

            const navigateTool = tools.tools.find(tool => tool.name === "navigate");

            expect(navigateTool).toBeDefined();
            expect(navigateTool?.description).toBe("Open a URL in the browser");
            expect(navigateTool?.inputSchema.properties).toHaveProperty("url");
        });
    });

    describe("navigate tool execution", () => {
        it("should successfully navigate to a valid URL", async () => {
            const url = "https://example.com";
            const result = await client.callTool({ name: "navigate", arguments: { url } });

            expect(result.isError).toBe(false);
            expect(result.content).toBeDefined();

            const content = result.content as Array<{ type: string; text: string }>;

            expect(content).toHaveLength(1);
            expect(content[0].type).toBe("text");
            expect(content[0].text).toContain(`Successfully navigated to ${url}`);
            expect(content[0].text).toContain("## Testplane Code");
            expect(content[0].text).toContain(`await browser.url("${url}");`);
        });

        it("should include browser state information in response", async () => {
            const url = "https://example.com";
            const result = await client.callTool({ name: "navigate", arguments: { url } });

            expect(result.isError).toBe(false);
            const content = result.content as Array<{ type: string; text: string }>;
            const responseText = content[0].text;

            expect(responseText).toContain("## Browser Tabs");
            expect(responseText).toContain("Title: Example Domain");

            expect(responseText).toContain("## Current Tab Snapshot");
            expect(responseText).toContain("This domain is for use in illustrative examples in documents.");
        });
    });

    describe("navigate tool error handling", () => {
        it("should handle missing URL parameter", async () => {
            try {
                await client.callTool({ name: "navigate", arguments: {} });
                expect.fail("Expected navigation without URL to fail");
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        it("should reject invalid URLs", async () => {
            const invalidUrls = ["not-a-url", "localhost:3000"];

            for (const url of invalidUrls) {
                try {
                    await client.callTool({ name: "navigate", arguments: { url } });
                    expect.fail(`Expected navigation to ${url} to fail, but it succeeded`);
                } catch (error) {
                    expect(error).toBeDefined();
                }
            }
        });

        it("should handle empty URL parameter", async () => {
            try {
                await client.callTool({ name: "navigate", arguments: { url: "" } });
                expect.fail("Expected navigation with empty URL to fail");
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });
});
