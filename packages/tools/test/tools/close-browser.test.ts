import { describe, it, expect, afterEach } from "vitest";
import { WdioBrowser } from "testplane";

import { closeBrowser } from "../../src/tools/close-browser.js";
import { navigate } from "../../src/tools/navigate.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/closeBrowser",
    () => {
        let browser: WdioBrowser | null = null;

        afterEach(async () => {
            if (browser) {
                try {
                    await browser.deleteSession();
                } catch {
                    // ignore
                }
                browser = null;
            }
        });

        describe("closeBrowser tool execution", () => {
            it("should close an active browser session", async () => {
                browser = await launchHeadlessBrowser();
                await navigate.cb({ url: "https://example.com" }, browser);

                const result = await closeBrowser.cb({}, browser);

                expect(result.isError).toBe(false);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");
                expect(getTextContent(result)).toBe("Browser session closed successfully");

                // Session already deleted — clear reference so afterEach skips it.
                browser = null;
            });

            it("should handle closing when no browser session is active", async () => {
                const result = await closeBrowser.cb({}, null);

                expect(result.isError).toBe(false);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");
                expect(getTextContent(result)).toBe("No active browser session to close");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
