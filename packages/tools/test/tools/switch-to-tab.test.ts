import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { switchToTab } from "../../src/tools/switch-to-tab.js";
import { listTabs } from "../../src/tools/list-tabs.js";
import { openNewTab } from "../../src/tools/open-new-tab.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/switchToTab",
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

        // Before each test, reset the browser to a single tab at example.com
        // then open the playground and a blank tab to produce 3 tabs total.
        beforeEach(async () => {
            const handles = await browser.getWindowHandles();
            for (let i = handles.length - 1; i > 0; i--) {
                await browser.switchToWindow(handles[i]);
                await browser.closeWindow();
            }
            await browser.switchToWindow((await browser.getWindowHandles())[0]);
            await browser.url("https://example.com");

            await openNewTab.cb({ url: playgroundUrl }, browser);
            await openNewTab.cb({}, browser);
        });

        describe("switchToTab tool execution with multiple tabs", () => {
            it("should handle tab number out of range", async () => {
                const result = await switchToTab.cb({ tabNumber: 5 }, browser);

                expect(result.isError).toBe(true);
                const text = getTextContent(result);
                expect(text).toContain("out of range");
                expect(text).toContain("Available range: 1-3");
            });

            it("should switch to tab 2 (Playground)", async () => {
                const result = await switchToTab.cb({ tabNumber: 2 }, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Switched to tab 2: Element Click Test Playground");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toMatch(/Element Click Test Playground.*\(current\)/);
            });

            it("should detect when already on the requested tab", async () => {
                const result = await switchToTab.cb({ tabNumber: 3 }, browser);

                expect(result.isError).toBe(false);
                const responseText = getTextContent(result);

                expect(responseText).toContain("Already on tab 3");
                expect(responseText).toContain("## Browser Tabs");
                expect(responseText).toMatch(/Untitled.*\(current\)/);
            });

            it("should verify tab switch with listTabs", async () => {
                await switchToTab.cb({ tabNumber: 1 }, browser);

                const listResult = await listTabs.cb({}, browser);

                expect(listResult.isError).toBe(false);
                const responseText = getTextContent(listResult);

                expect(responseText).toMatch(/1\. Title: Example Domain.*\(current\)/);
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
