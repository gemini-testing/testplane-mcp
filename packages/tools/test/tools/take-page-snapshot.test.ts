import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { takePageSnapshot } from "../../src/tools/take-page-snapshot.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/takePageSnapshot",
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

        describe("takePageSnapshot tool execution", () => {
            it("should capture snapshot of playground page with expected content", async () => {
                const result = await takePageSnapshot.cb({}, browser);

                expect(result.isError).toBe(false);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");

                const responseText = content[0].text;

                expect(responseText).toContain("Element Click Test Playground");
                expect(responseText).toContain("Role-based Elements");
                expect(responseText).toContain("Submit Form");
                expect(responseText).toContain("Text-based Elements");
                expect(responseText).toContain("Form Elements");
                expect(responseText).toContain("Email Address");
                expect(responseText).toContain("Placeholder Elements");
                expect(responseText).toContain("Enter your name");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
