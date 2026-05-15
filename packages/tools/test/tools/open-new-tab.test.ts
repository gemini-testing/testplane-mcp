import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { openNewTab } from "../../src/tools/open-new-tab.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/openNewTab",
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

        // Reset to a single blank tab (about:blank) before each test to simulate
        // "fresh browser" state — openNewTab will reuse that blank tab.
        const resetToBlank = async (): Promise<void> => {
            const handles = await browser.getWindowHandles();
            for (let i = handles.length - 1; i > 0; i--) {
                await browser.switchToWindow(handles[i]);
                await browser.closeWindow();
            }
            await browser.switchToWindow((await browser.getWindowHandles())[0]);
            await browser.url("about:blank");
        };

        describe("openNewTab tool execution on fresh blank tab (reuse behavior)", () => {
            beforeEach(async () => {
                await resetToBlank();
            });

            it("should reuse blank tab when no URL provided", async () => {
                const result = await openNewTab.cb({}, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Opened new tab");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("1. Title: Untitled");

                // Should have exactly one tab (blank tab is reused, not added).
                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(1);
            });

            it("should reuse blank tab and navigate to URL when URL provided", async () => {
                const result = await openNewTab.cb({ url: playgroundUrl }, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Opened new tab and navigated to");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("1. Title: Element Click Test Playground");
                expect(responseText).toContain("(current)");

                // Should have exactly one tab (blank tab reused).
                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(1);
            });
        });

        describe("openNewTab tool execution when browser already has a content tab", () => {
            beforeEach(async () => {
                await resetToBlank();
                // Navigate to example.com so the current tab is no longer considered
                // a fresh blank tab and subsequent openNewTab calls actually open new tabs.
                await browser.url("https://example.com");
            });

            it("should add new blank tab to existing tabs", async () => {
                const result = await openNewTab.cb({}, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Opened new tab");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("1. Title: Example Domain");
                expect(responseText).toContain("2. Title: Untitled");
                expect(responseText).toContain("about:blank (current)");

                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(2);
            });

            it("should add new tab with URL to existing tabs", async () => {
                const result = await openNewTab.cb({ url: playgroundUrl }, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Opened new tab and navigated to");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("1. Title: Example Domain");
                expect(responseText).toContain("2. Title: Element Click Test Playground");
                expect(responseText).toContain("(current)");

                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(2);

                expect(responseText).toMatch(/Element Click Test Playground.*\(current\)/);
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
