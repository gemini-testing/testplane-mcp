import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";

const MOBILE_EMULATION_CAPABILITIES = {
    browserName: "chrome",
    "goog:chromeOptions": {
        mobileEmulation: {
            deviceMetrics: {
                width: 360,
                height: 640,
                pixelRatio: 3.0,
            },
            userAgent:
                "Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Mobile Safari/537.36",
        },
    },
};

const MOBILE_INFO_PAGE = "mobile-info.html";

describe(
    "tools/launchBrowser",
    () => {
        let client: Client;
        let testServer: PlaygroundServer;
        let playgroundUrl: string;
        let mobileInfoUrl: string;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
            mobileInfoUrl = new URL(MOBILE_INFO_PAGE, `${playgroundUrl}/`).toString();
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

        describe("launchBrowser tool availability", () => {
            it("should list launchBrowser tool in available tools", async () => {
                const tools = await client.listTools();

                const launchBrowserTool = tools.tools.find(tool => tool.name === "launchBrowser");

                expect(launchBrowserTool).toBeDefined();
                expect(launchBrowserTool?.description).toBe(
                    "Launch a new browser session with custom desired capabilities. Avoid using this tool unless the user explicitly requests a custom browser configuration; browsers are launched automatically for commands like navigate to URL. Currently only Chrome and Firefox are supported.",
                );
                expect(launchBrowserTool?.inputSchema.properties).toHaveProperty("desiredCapabilities");
            });
        });

        describe("launchBrowser tool execution", () => {
            it("should launch a browser with custom desired capabilities", async () => {
                await client.callTool({
                    name: "launchBrowser",
                    arguments: {
                        desiredCapabilities: MOBILE_EMULATION_CAPABILITIES,
                    },
                });

                await client.callTool({ name: "navigate", arguments: { url: mobileInfoUrl } });

                const snapshotResult = await client.callTool({ name: "takePageSnapshot", arguments: {} });
                const snapshotText = (snapshotResult.content?.[0] as { text?: string } | undefined)?.text ?? "";

                expect(snapshotText).toContain("Viewport width: 360");
                expect(snapshotText).toContain("Device pixel ratio: 3");
                expect(snapshotText).toContain("User agent: Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2 XL)");
            });

            it("should reject unsupported browser names", async () => {
                const result = await client.callTool({
                    name: "launchBrowser",
                    arguments: {
                        desiredCapabilities: {
                            browserName: "safari",
                        },
                    },
                });

                expect(result.isError).toBe(true);
                expect(result.content).toBeDefined();

                const errorContent = result.content as Array<{ type: string; text: string }>;

                expect(errorContent).toHaveLength(1);
                expect(errorContent[0].type).toBe("text");
                expect(errorContent[0].text).toContain('Only "chrome" and "firefox"');

                const url = "https://example.com";
                const navigateResult = await client.callTool({ name: "navigate", arguments: { url } });
                expect(navigateResult.content).toBeDefined();

                const navigateContent = navigateResult.content as Array<{ type: string; text: string }>;

                expect(navigateContent[0].type).toBe("text");
                expect(navigateContent[0].text).toContain("Successfully navigated to https://example.com");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
