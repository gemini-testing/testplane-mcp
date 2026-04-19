import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { closeTab } from "../../src/tools/close-tab.js";
import { listTabs } from "../../src/tools/list-tabs.js";
import { openNewTab } from "../../src/tools/open-new-tab.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/closeTab",
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

        const resetToSingleTab = async (url: string): Promise<void> => {
            const handles = await browser.getWindowHandles();
            for (let i = handles.length - 1; i > 0; i--) {
                await browser.switchToWindow(handles[i]);
                await browser.closeWindow();
            }
            await browser.switchToWindow((await browser.getWindowHandles())[0]);
            await browser.url(url);
        };

        describe("closeTab tool error handling", () => {
            beforeEach(async () => {
                await resetToSingleTab("https://example.com");
            });

            it("should return error when trying to close the last remaining tab", async () => {
                const result = await closeTab.cb({}, browser);

                expect(result.isError).toBe(true);
                const text = getTextContent(result);
                expect(text).toContain("Cannot close tab — this is the last remaining tab");
            });
        });

        describe("closeTab tool execution with multiple tabs", () => {
            beforeEach(async () => {
                // Create 3 tabs: example.com, playground, blank
                await resetToSingleTab("https://example.com");
                await openNewTab.cb({ url: playgroundUrl }, browser);
                await openNewTab.cb({}, browser);
            });

            it("should handle tab number out of range", async () => {
                const result = await closeTab.cb({ tabNumber: 5 }, browser);

                expect(result.isError).toBe(true);
                const text = getTextContent(result);
                expect(text).toContain("out of range");
                expect(text).toContain("Available range: 1-3");
            });

            it("should close current tab (tab 3) when no tabNumber provided", async () => {
                const result = await closeTab.cb({}, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Closed tab 3: Untitled");

                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(2);
            });

            it("should close specific tab by number (tab 1)", async () => {
                const result = await closeTab.cb({ tabNumber: 1 }, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Closed tab 1: Example Domain");
                expect(responseText).toContain("https://example.com");

                const tabMatches = responseText.match(/\d+\. Title:/g);
                expect(tabMatches).toHaveLength(2);
                expect(responseText).toMatch(/Untitled.*\(current\)/);
            });

            it("should verify tab closure with listTabs", async () => {
                await closeTab.cb({ tabNumber: 1 }, browser);

                const listResult = await listTabs.cb({}, browser);

                expect(listResult.isError).toBe(false);
                const responseText = getTextContent(listResult);

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
