import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { navigate } from "../../src/tools/navigate.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/navigate",
    () => {
        let browser: WdioBrowser;
        let testServer: PlaygroundServer;
        let playgroundUrl: string;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
            browser = await launchHeadlessBrowser();
        }, 20000);

        afterAll(async () => {
            if (browser) await browser.deleteSession();
            if (testServer) await testServer.stop();
        });

        it("should successfully navigate to a valid URL", async () => {
            const result = await navigate.cb({ url: playgroundUrl }, browser);

            expect(result.isError).toBe(false);
            const text = getTextContent(result);
            expect(text).toContain(`Successfully navigated to ${playgroundUrl}`);
            expect(text).toContain("## Testplane Code");
            expect(text).toContain(`await browser.openAndWait("${playgroundUrl}");`);
        });

        it("should include browser state information in response", async () => {
            const result = await navigate.cb({ url: playgroundUrl }, browser);

            expect(result.isError).toBe(false);
            const text = getTextContent(result);
            expect(text).toContain("## Browser Tabs");
            expect(text).toContain("## Current Tab Snapshot");
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
