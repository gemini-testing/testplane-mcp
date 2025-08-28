import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe(
    "tools/takeViewportScreenshot",
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

        describe("takeViewportScreenshot tool availability", () => {
            it("should list takeViewportScreenshot tool in available tools", async () => {
                const tools = await client.listTools();

                const screenshotTool = tools.tools.find(tool => tool.name === "takeViewportScreenshot");

                expect(screenshotTool).toBeDefined();
                expect(screenshotTool?.description).toContain(
                    "Capture a PNG screenshot of the current browser viewport",
                );
                expect(screenshotTool?.inputSchema.properties).toHaveProperty("filePath");
            });
        });

        describe("takeViewportScreenshot tool execution", () => {
            it("should capture screenshot with default filePath in tmp directory", async () => {
                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                const result = await client.callTool({
                    name: "takeViewportScreenshot",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");

                const responseText = content[0].text;

                expect(responseText).toContain("✅ Viewport screenshot captured successfully");
                expect(responseText).toContain(os.tmpdir());
                expect(responseText).toContain("viewport-");
                expect(responseText).toContain(".png");
                expect(responseText).toContain("KB)");

                const filePathMatch = responseText.match(/Screenshot saved: ([^\s]+)/);
                expect(filePathMatch).toBeTruthy();

                if (filePathMatch) {
                    const filePath = filePathMatch[1];
                    const fileExists = await fs
                        .access(filePath)
                        .then(() => true)
                        .catch(() => false);
                    expect(fileExists).toBe(true);

                    if (fileExists) {
                        const stats = await fs.stat(filePath);
                        expect(stats.size).toBeGreaterThan(0);
                        await fs.unlink(filePath).catch(() => {});
                    }
                }
            });

            it("should capture screenshot with custom filePath", async () => {
                const customFilePath = path.join(os.tmpdir(), "test-screenshot.png");

                await fs.unlink(customFilePath).catch(() => {});

                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                const result = await client.callTool({
                    name: "takeViewportScreenshot",
                    arguments: { filePath: customFilePath },
                });

                expect(result.isError).toBe(false);

                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("✅ Viewport screenshot captured successfully");
                expect(responseText).toContain(`Screenshot saved: ${customFilePath}`);
                expect(responseText).toContain(`await browser.saveScreenshot("${customFilePath}")`);

                const fileExists = await fs
                    .access(customFilePath)
                    .then(() => true)
                    .catch(() => false);
                expect(fileExists).toBe(true);

                if (fileExists) {
                    const stats = await fs.stat(customFilePath);
                    expect(stats.size).toBeGreaterThan(0);
                    await fs.unlink(customFilePath).catch(() => {});
                }
            });

            it("should create directory if it doesn't exist", async () => {
                const testDir = path.join(os.tmpdir(), "test-screenshots-" + Date.now());
                const customFilePath = path.join(testDir, "nested", "screenshot.png");

                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                const result = await client.callTool({
                    name: "takeViewportScreenshot",
                    arguments: { filePath: customFilePath },
                });

                expect(result.isError).toBe(false);

                const fileExists = await fs
                    .access(customFilePath)
                    .then(() => true)
                    .catch(() => false);
                expect(fileExists).toBe(true);

                if (fileExists) {
                    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
                }
            });

            it("should include browser tabs information in response", async () => {
                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                const result = await client.callTool({
                    name: "takeViewportScreenshot",
                    arguments: {},
                });

                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("Element Click Test Playground");
            });

            it("should not include page snapshot in response", async () => {
                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                const result = await client.callTool({
                    name: "takeViewportScreenshot",
                    arguments: {},
                });

                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).not.toContain("## Current Tab Snapshot");
            });
        });

        describe("takeViewportScreenshot error handling", () => {
            it("should handle screenshot capture when no page is loaded", async () => {
                const result = await client.callTool({
                    name: "takeViewportScreenshot",
                    arguments: {},
                });

                expect(result.isError).toBe(false);

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);

                const responseText = content[0].text;
                expect(responseText).toContain("Screenshot saved:");
            });

            it("should handle invalid file path gracefully", async () => {
                const invalidPath = "/invalid\0path/screenshot.png";

                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                const result = await client.callTool({
                    name: "takeViewportScreenshot",
                    arguments: { filePath: invalidPath },
                });

                expect(result.isError).toBe(true);

                const content = result.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("❌");
                expect(responseText).toContain("Error taking viewport screenshot");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
