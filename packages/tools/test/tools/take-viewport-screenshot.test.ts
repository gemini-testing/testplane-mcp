import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { takeViewportScreenshot } from "../../src/tools/take-viewport-screenshot.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/takeViewportScreenshot",
    () => {
        let browser: WdioBrowser;
        let playgroundUrl: string;
        let testServer: PlaygroundServer;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
            browser = await launchHeadlessBrowser();
        }, 20000);

        afterAll(async () => {
            if (browser) await browser.deleteSession();
            if (testServer) await testServer.stop();
        });

        beforeEach(async () => {
            await browser.url(playgroundUrl);
        });

        describe("takeViewportScreenshot tool execution", () => {
            it("should capture screenshot with default filePath in tmp directory", async () => {
                const result = await takeViewportScreenshot.cb({}, browser);

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

                const result = await takeViewportScreenshot.cb({ filePath: customFilePath }, browser);

                expect(result.isError).toBe(false);

                const responseText = getTextContent(result);

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

                const result = await takeViewportScreenshot.cb({ filePath: customFilePath }, browser);

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
                const result = await takeViewportScreenshot.cb({}, browser);

                const responseText = getTextContent(result);

                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("Element Click Test Playground");
            });

            it("should not include page snapshot in response", async () => {
                const result = await takeViewportScreenshot.cb({}, browser);

                const responseText = getTextContent(result);

                expect(responseText).not.toContain("## Current Tab Snapshot");
            });
        });

        describe("takeViewportScreenshot error handling", () => {
            it("should handle invalid file path gracefully", async () => {
                const invalidPath = "/invalid\0path/screenshot.png";

                const result = await takeViewportScreenshot.cb({ filePath: invalidPath }, browser);

                expect(result.isError).toBe(true);

                const responseText = getTextContent(result);

                expect(responseText).toContain("❌");
                expect(responseText).toContain("Error taking viewport screenshot");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
