import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { launchBrowser } from "testplane/unstable";

export const BROWSER_NAME = (process.env.BROWSER || "chrome").toLowerCase() as string;

export const BROWSER_CONFIG = {
    desiredCapabilities: {
        browserName: BROWSER_NAME,
    },
    headless: true,
    system: {
        debug: Boolean(process.env.DEBUG) || false,
    },
};

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
        let client: Client;

        beforeEach(async () => {
            client = await startClient();
        });

        afterEach(async () => {
            if (client) {
                await client.close();
            }
        });

        describe("attachToBrowser tool availability", () => {
            it("should list attachToBrowser tool in available tools", async () => {
                const tools = await client.listTools();

                const attachToBrowserTool = tools.tools.find(tool => tool.name === "attachToBrowser");

                expect(attachToBrowserTool).toBeDefined();
                expect(attachToBrowserTool?.description).toBe("Attach to existing browser session");
            });
        });

        describe("attachToBrowser tool execution", () => {
            it("error if connect to unexisting session", async () => {
                const result = await client.callTool({
                    name: "attachToBrowser",
                    arguments: {
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
                });

                expect(result.isError).toBe(true);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;

                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");
                expect(content[0].text).toContain("Error attach to browser:");

                // Check that after error attach we still have working browser
                const url = "https://example.com";
                const navigateResult = await client.callTool({ name: "navigate", arguments: { url } });
                const navigateContent = navigateResult.content as Array<{ type: string; text: string }>;

                expect(navigateResult.isError).toBe(false);
                expect(navigateContent[0].type).toBe("text");
                expect(navigateContent[0].text).toContain("✅ Successfully navigated to https://example.com");
            });

            it("should attach to existing browser session", async () => {
                const browser: WebdriverIO.Browser & { getDriverPid?: () => number | undefined } =
                    await launchBrowser(BROWSER_CONFIG);
                const driverPid = (await browser.getDriverPid!()) as number;

                const result = await client.callTool({
                    name: "attachToBrowser",
                    arguments: {
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
                });

                expect(result.isError).toBe(false);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");
                expect(content[0].text).toBe("Successfully attached to existing browser session");

                // Check that browser process exist
                expect(checkProcessExists(driverPid)).toBe(true);

                // Call closeBrowser tool
                await client.callTool({
                    name: "closeBrowser",
                    arguments: {},
                });

                await browser.pause(100);

                // Check that browser process doesn't exist
                expect(checkProcessExists(driverPid)).toBe(false);

                // Check that after close session and call navigate we run new browser
                const url = "https://example.com";
                const navigateResult = await client.callTool({ name: "navigate", arguments: { url } });
                const navigateContent = navigateResult.content as Array<{ type: string; text: string }>;

                expect(navigateResult.isError).toBe(false);
                expect(navigateContent[0].type).toBe("text");
                expect(navigateContent[0].text).toContain("✅ Successfully navigated to https://example.com");

                // Call closeBrowser tool
                await client.callTool({
                    name: "closeBrowser",
                    arguments: {},
                });
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
