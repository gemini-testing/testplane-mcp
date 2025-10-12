import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";
import { launchBrowser } from "testplane/unstable";

const checkProcessExists = (pid: number): boolean => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

describe(
    "tools/launchBrowser",
    () => {
        let client: Client;
        let playgroundUrl: string;
        let testServer: PlaygroundServer;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
        }, 20000);

        afterAll(async () => {
            if (testServer) {
                await testServer.stop();
            }
        });

        beforeEach(async () => {
            client = await startClient();
        });

        afterEach(async () => {
            if (client) {
                await client.close();
            }
        });

        describe("tool availability", () => {
            it("should list launchBrowser tool in available tools", async () => {
                const tools = await client.listTools();

                const launchBrowserTool = tools.tools.find(tool => tool.name === "launchBrowser");

                expect(launchBrowserTool).toBeDefined();
                expect(launchBrowserTool?.description).toContain("Launch a new browser session");
                expect(launchBrowserTool?.inputSchema.properties).toHaveProperty("desiredCapabilities");
                expect(launchBrowserTool?.inputSchema.properties).toHaveProperty("gridUrl");
                expect(launchBrowserTool?.inputSchema.properties).toHaveProperty("windowSize");
            });
        });

        describe("basic browser launch", () => {
            it("should launch browser with default settings", async () => {
                const result = await client.callTool({
                    name: "launchBrowser",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toBe("Successfully launched browser session");

                const navigateResult = await client.callTool({
                    name: "navigate",
                    arguments: { url: "https://example.com" },
                });

                expect(navigateResult.isError).toBe(false);
                const navigateContent = navigateResult.content as Array<{ type: string; text: string }>;
                expect(navigateContent[0].text).toContain("✅ Successfully navigated to https://example.com");
            });

            it("should launch browser with explicit local gridUrl", async () => {
                const result = await client.callTool({
                    name: "launchBrowser",
                    arguments: { gridUrl: "local" },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toBe("Successfully launched browser session");
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

                const launchResult = await client.callTool({
                    name: "launchBrowser",
                    arguments: {
                        desiredCapabilities: mobileCapabilities,
                    },
                });

                expect(launchResult.isError).toBe(false);
                const launchContent = launchResult.content as Array<{ type: string; text: string }>;
                expect(launchContent[0].text).toBe("Successfully launched browser session");

                const navigateResult = await client.callTool({
                    name: "navigate",
                    arguments: { url: `${playgroundUrl}/mobile-info.html` },
                });

                expect(navigateResult.isError).toBe(false);
                const content = navigateResult.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Viewport width: 375");
                expect(responseText).toContain("Viewport height: 667");
                expect(responseText).toContain("Device pixel ratio: 2");
            });
        });

        describe("window size configuration", () => {
            it("should launch browser with window size as object", async () => {
                const launchResult = await client.callTool({
                    name: "launchBrowser",
                    arguments: {
                        windowSize: { width: 1280, height: 720 },
                    },
                });

                expect(launchResult.isError).toBe(false);
                const launchContent = launchResult.content as Array<{ type: string; text: string }>;
                expect(launchContent[0].text).toBe("Successfully launched browser session");

                const navigateResult = await client.callTool({
                    name: "navigate",
                    arguments: { url: `${playgroundUrl}/mobile-info.html` },
                });

                expect(navigateResult.isError).toBe(false);
                const content = navigateResult.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Viewport width: 1280");
                // Viewport height is less than window height due to browser chrome
                expect(responseText).toContain("Viewport height: 528");
            });

            it("should launch browser with window size as string", async () => {
                const launchResult = await client.callTool({
                    name: "launchBrowser",
                    arguments: {
                        windowSize: "1024x768",
                    },
                });

                expect(launchResult.isError).toBe(false);
                const launchContent = launchResult.content as Array<{ type: string; text: string }>;
                expect(launchContent[0].text).toBe("Successfully launched browser session");

                const navigateResult = await client.callTool({
                    name: "navigate",
                    arguments: { url: `${playgroundUrl}/mobile-info.html` },
                });

                expect(navigateResult.isError).toBe(false);
                const content = navigateResult.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Viewport width: 1024");
                // Viewport height is less than window height due to browser chrome
                expect(responseText).toContain("Viewport height: 576");
            });

            it("should launch browser with windowSize null to reset to default", async () => {
                const launchResult = await client.callTool({
                    name: "launchBrowser",
                    arguments: {
                        windowSize: null,
                    },
                });

                expect(launchResult.isError).toBe(false);
                const launchContent = launchResult.content as Array<{ type: string; text: string }>;
                expect(launchContent[0].text).toBe("Successfully launched browser session");

                const navigateResult = await client.callTool({
                    name: "navigate",
                    arguments: { url: `${playgroundUrl}/mobile-info.html` },
                });

                expect(navigateResult.isError).toBe(false);
                const content = navigateResult.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("✅ Successfully navigated to");
            });
        });

        describe("grid URL configuration", () => {
            it("should handle invalid gridUrl with understandable error message", async () => {
                const result = await client.callTool({
                    name: "launchBrowser",
                    arguments: {
                        gridUrl: "http://localhost:9999",
                    },
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toMatch(
                    /Error launching browser.*Unable to connect to.*http:\/\/localhost:9999/s,
                );
            });
        });

        describe("browser replacement", () => {
            it("should close existing browser before launching new one", async () => {
                const firstBrowser: WebdriverIO.Browser & { getDriverPid?: () => number | undefined } =
                    await launchBrowser({
                        headless: "new",
                        desiredCapabilities: {
                            "goog:chromeOptions": {
                                args: process.env.DISABLE_BROWSER_SANDBOX
                                    ? ["--no-sandbox", "--disable-dev-shm-usage"]
                                    : [],
                            },
                        },
                    });
                const firstDriverPid = (await firstBrowser.getDriverPid!()) as number;

                const attachResult = await client.callTool({
                    name: "attachToBrowser",
                    arguments: {
                        session: {
                            sessionId: firstBrowser.sessionId,
                            sessionCaps: firstBrowser.capabilities,
                            sessionOpts: {
                                capabilities: firstBrowser.capabilities,
                                ...firstBrowser.options,
                            },
                            driverPid: firstDriverPid,
                        },
                    },
                });

                expect(attachResult.isError).toBe(false);
                expect(checkProcessExists(firstDriverPid)).toBe(true);

                const launchResult = await client.callTool({
                    name: "launchBrowser",
                    arguments: {
                        windowSize: { width: 800, height: 600 },
                    },
                });

                expect(launchResult.isError).toBe(false);
                const launchContent = launchResult.content as Array<{ type: string; text: string }>;
                expect(launchContent[0].text).toBe("Successfully launched browser session");

                await firstBrowser.pause(100);

                expect(checkProcessExists(firstDriverPid)).toBe(false);

                const navigateResult = await client.callTool({
                    name: "navigate",
                    arguments: { url: `${playgroundUrl}/mobile-info.html` },
                });

                expect(navigateResult.isError).toBe(false);
                const content = navigateResult.content as Array<{ type: string; text: string }>;
                const responseText = content[0].text;

                expect(responseText).toContain("Viewport width: 800");
                // Viewport height is less than window height due to browser chrome
                expect(responseText).toContain("Viewport height: 408");
            });
        });

        describe("error handling", () => {
            it("should reject unsupported browser name with actionable error message", async () => {
                const result = await client.callTool({
                    name: "launchBrowser",
                    arguments: {
                        desiredCapabilities: {
                            browserName: "unsupportedBrowser",
                        },
                    },
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toMatch(
                    /Error launching browser.*Running browser "unsupportedBrowser" is unsupported.*Supported browsers/s,
                );
            });

            it("should reject invalid browserName type in desiredCapabilities", async () => {
                try {
                    await client.callTool({
                        name: "launchBrowser",
                        arguments: {
                            desiredCapabilities: {
                                browserName: 123,
                            },
                        },
                    });
                    expect.fail("Expected launchBrowser with invalid browserName to fail");
                } catch (error) {
                    expect(String(error)).toContain('\\"browserName\\" must be a string');
                }
            });

            it("should reject invalid windowSize format", async () => {
                try {
                    await client.callTool({
                        name: "launchBrowser",
                        arguments: {
                            windowSize: "invalid-format",
                        },
                    });
                    expect.fail("Expected launchBrowser with invalid windowSize to fail");
                } catch (error) {
                    expect(String(error)).toContain('should use the format \\"<width>x<height>\\"');
                }
            });

            it("should reject windowSize with negative dimensions", async () => {
                try {
                    await client.callTool({
                        name: "launchBrowser",
                        arguments: {
                            windowSize: { width: -100, height: 600 },
                        },
                    });
                    expect.fail("Expected launchBrowser with negative width to fail");
                } catch (error) {
                    expect(String(error)).toContain("Number must be greater than 0");
                }
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
