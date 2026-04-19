import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { listTabs } from "../../src/tools/list-tabs.js";
import { openNewTab } from "../../src/tools/open-new-tab.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/listTabs",
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
            // Reset browser to a single tab at playground URL before each test.
            const handles = await browser.getWindowHandles();
            for (let i = handles.length - 1; i > 0; i--) {
                await browser.switchToWindow(handles[i]);
                await browser.closeWindow();
            }
            await browser.switchToWindow((await browser.getWindowHandles())[0]);
            await browser.url(playgroundUrl);
        });

        describe("listTabs tool execution", () => {
            it("should list tabs when browser is active with single tab", async () => {
                const result = await listTabs.cb({}, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Retrieved list of browser tabs");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toContain("Element Click Test Playground");
                expect(responseText).toContain("(current)");
            });

            it("should list multiple tabs with correct numbering and active indicator", async () => {
                await openNewTab.cb({ url: "https://example.com" }, browser);
                await openNewTab.cb({}, browser);

                const result = await listTabs.cb({}, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Retrieved list of browser tabs");
                expect(responseText).toContain("## Browser Tabs");

                expect(responseText).toContain("1. Title: Element Click Test Playground");
                expect(responseText).toContain("2. Title: Example Domain");
                expect(responseText).toContain("3. Title: Untitled");

                const currentMatches = responseText.match(/about:blank \(current\)/g);
                expect(currentMatches).toHaveLength(1);
            });

            it("should not include snapshot in response", async () => {
                const result = await listTabs.cb({}, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).not.toContain("## Current Tab Snapshot");
                expect(responseText).not.toContain("## Testplane Code");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
