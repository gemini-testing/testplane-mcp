import { describe, it, expect, afterEach } from "vitest";
import { WdioBrowser } from "testplane";

import { attachToBrowser } from "../../src/tools/attach-to-browser.js";
import { closeBrowser } from "../../src/tools/close-browser.js";
import { navigate } from "../../src/tools/navigate.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

const checkProcessExists = (pid: number): boolean => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

describe(
    "tools/attachToBrowser",
    () => {
        let extraBrowsers: Array<WdioBrowser | null> = [];

        afterEach(async () => {
            for (const b of extraBrowsers) {
                if (b) {
                    try {
                        await b.deleteSession();
                    } catch {
                        // ignore
                    }
                }
            }
            extraBrowsers = [];
        });

        describe("attachToBrowser tool execution", () => {
            it("error if connect to unexisting session", async () => {
                const result = await attachToBrowser.cb(
                    {
                        session: {
                            sessionId: "ffe4129f99be1125e304242500121efa",
                            sessionCaps: {
                                browserName: "chrome",
                                browserVersion: "137.0.7151.119",
                                setWindowRect: true,
                            },
                            sessionOpts: {
                                protocol: "http",
                                hostname: "127.0.0.1",
                                port: 49426,
                                path: "/",
                            },
                        },
                    },
                    {},
                );
                extraBrowsers.push(result.browser);

                expect(result.response.isError).toBe(true);
                expect(result.response.content).toBeDefined();

                const content = result.response.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");
                expect(content[0].text).toContain("Error attach to browser:");
                expect(result.browser).toBeNull();
            });

            it("should attach to existing browser session", async () => {
                const browser: WdioBrowser & { getDriverPid?: () => number | undefined } =
                    await launchHeadlessBrowser();
                extraBrowsers.push(browser);

                const driverPid = (await browser.getDriverPid!()) as number;

                const result = await attachToBrowser.cb(
                    {
                        session: {
                            sessionId: browser.sessionId,
                            sessionCaps: browser.capabilities,
                            sessionOpts: {
                                capabilities: browser.capabilities,
                                ...browser.options,
                            },
                            driverPid,
                        },
                    },
                    {},
                );

                expect(result.response.isError).toBe(false);
                expect(result.response.content).toBeDefined();

                const content = result.response.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");
                expect(content[0].text).toBe("Successfully attached to existing browser session");

                // The attached browser process should still exist
                expect(checkProcessExists(driverPid)).toBe(true);
                expect(result.browser).not.toBeNull();

                // Navigate on the attached browser works
                const url = "https://example.com";
                const navigateResult = await navigate.cb({ url }, result.browser!);
                expect(navigateResult.isError).toBe(false);
                expect(getTextContent(navigateResult)).toContain("✅ Successfully navigated to https://example.com");

                // closeBrowser should actually terminate the process
                const closeResult = await closeBrowser.cb({}, result.browser);
                expect(closeResult.isError).toBe(false);

                await new Promise(resolve => setTimeout(resolve, 100));
                expect(checkProcessExists(driverPid)).toBe(false);

                // Remove from cleanup list since it's already closed
                extraBrowsers = extraBrowsers.filter(b => b !== browser);
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
