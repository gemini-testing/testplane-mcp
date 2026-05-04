import { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";

import { launchBrowser } from "../../src/tools/launch-browser.js";
import { navigate } from "../../src/tools/navigate.js";
import { PlaygroundServer } from "../test-server.js";
import { getTextContent, readSnapshotFromResponse } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/launchBrowser",
    () => {
        let playgroundUrl: string;
        let testServer: PlaygroundServer;
        let activeBrowser: WdioBrowser | null = null;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
        }, 20000);

        afterAll(async () => {
            if (testServer) await testServer.stop();
        });

        afterEach(async () => {
            if (activeBrowser) {
                try {
                    await activeBrowser.deleteSession();
                } catch {
                    // ignore
                }
                activeBrowser = null;
            }
        });

        describe("basic browser launch", () => {
            it("should launch browser with default settings", async () => {
                const result = await launchBrowser.cb({ gridUrl: "local" }, { headless: true });
                activeBrowser = result.browser;

                expect(result.response.isError).toBe(false);
                expect(getTextContent(result.response)).toBe("Successfully launched browser session");
                expect(result.browser).not.toBeNull();

                const navigateResult = await navigate.cb({ url: "https://example.com" }, result.browser!);

                expect(navigateResult.isError).toBe(false);
                expect(getTextContent(navigateResult)).toContain("✅ Successfully navigated to https://example.com");
            });

            it("should launch browser with explicit local gridUrl", async () => {
                const result = await launchBrowser.cb({ gridUrl: "local" }, { headless: true });
                activeBrowser = result.browser;

                expect(result.response.isError).toBe(false);
                expect(getTextContent(result.response)).toBe("Successfully launched browser session");
            });
        });

        describe("custom desiredCapabilities with mobile emulation", () => {
            it("should launch browser with mobile emulation capabilities", async () => {
                const mobileCapabilities = {
                    browserName: "chrome",
                    "goog:chromeOptions": {
                        mobileEmulation: {
                            deviceMetrics: {
                                width: 375,
                                height: 667,
                                pixelRatio: 2.0,
                            },
                        },
                    },
                };

                const launchResult = await launchBrowser.cb(
                    { desiredCapabilities: mobileCapabilities },
                    { headless: true },
                );
                activeBrowser = launchResult.browser;

                expect(getTextContent(launchResult.response)).toBe("Successfully launched browser session");

                const navigateResult = await navigate.cb(
                    { url: `${playgroundUrl}/mobile-info.html` },
                    launchResult.browser!,
                );

                expect(navigateResult.isError).toBe(false);
                const snapshot = await readSnapshotFromResponse(getTextContent(navigateResult));

                expect(snapshot).toContain("Viewport width: 375");
                expect(snapshot).toContain("Viewport height: 667");
                expect(snapshot).toContain("Device pixel ratio: 2");
            });
        });

        describe("window size configuration", () => {
            it("should launch browser with window size as object", async () => {
                const launchResult = await launchBrowser.cb(
                    { windowSize: { width: 1280, height: 720 } },
                    { headless: true },
                );
                activeBrowser = launchResult.browser;

                expect(getTextContent(launchResult.response)).toBe("Successfully launched browser session");

                const navigateResult = await navigate.cb(
                    { url: `${playgroundUrl}/mobile-info.html` },
                    launchResult.browser!,
                );

                expect(navigateResult.isError).toBe(false);
                const snapshot = await readSnapshotFromResponse(getTextContent(navigateResult));

                expect(snapshot).toContain("Viewport width: 1280");
                // Viewport height is less than window height due to browser chrome
                expect(snapshot).toContain("Viewport height: 577");
            });

            it("should launch browser with window size as string", async () => {
                const launchResult = await launchBrowser.cb({ windowSize: "1024x768" }, { headless: true });
                activeBrowser = launchResult.browser;

                expect(launchResult.response.isError).toBe(false);
                expect(getTextContent(launchResult.response)).toBe("Successfully launched browser session");

                const navigateResult = await navigate.cb(
                    { url: `${playgroundUrl}/mobile-info.html` },
                    launchResult.browser!,
                );

                expect(navigateResult.isError).toBe(false);
                const snapshot = await readSnapshotFromResponse(getTextContent(navigateResult));

                expect(snapshot).toContain("Viewport width: 1024");
                // Viewport height is less than window height due to browser chrome
                expect(snapshot).toContain("Viewport height: 625");
            });

            it("should launch browser with windowSize null to reset to default", async () => {
                const launchResult = await launchBrowser.cb({ windowSize: null }, { headless: true });
                activeBrowser = launchResult.browser;

                expect(launchResult.response.isError).toBe(false);
                expect(getTextContent(launchResult.response)).toBe("Successfully launched browser session");

                const navigateResult = await navigate.cb(
                    { url: `${playgroundUrl}/mobile-info.html` },
                    launchResult.browser!,
                );

                expect(navigateResult.isError).toBe(false);
                expect(getTextContent(navigateResult)).toContain("✅ Successfully navigated to");
            });
        });

        describe("grid URL configuration", () => {
            it("should handle invalid gridUrl with understandable error message", async () => {
                const result = await launchBrowser.cb({ gridUrl: "http://localhost:9999" }, { headless: true });
                activeBrowser = result.browser;

                expect(result.response.isError).toBe(true);
                expect(getTextContent(result.response)).toMatch(
                    /Error launching browser.*Unable to connect to.*http:\/\/localhost:9999/s,
                );
            });
        });

        describe("error handling", () => {
            it("should reject unsupported browser name with actionable error message", async () => {
                const result = await launchBrowser.cb(
                    {
                        desiredCapabilities: {
                            browserName: "unsupportedBrowser",
                        },
                    },
                    { headless: true },
                );
                activeBrowser = result.browser;

                expect(result.response.isError).toBe(true);
                expect(getTextContent(result.response)).toMatch(
                    /Error launching browser.*Running browser "unsupportedBrowser" is unsupported.*Supported browsers/s,
                );
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
