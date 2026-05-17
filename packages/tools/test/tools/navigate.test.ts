import http from "http";
import { AddressInfo } from "net";

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
            expect(text).toMatch(/The snapshot was saved to: .+\.testplane\/snapshots\/.+\.(yml|html)/);
        });

        it("should ignore failed resource loads while navigating", async () => {
            const flakyResourceServer = http.createServer((_req, res) => {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(
                    '<!doctype html><html><head><script src="http://127.0.0.1:9/failing-resource.js"></script></head><body>ok</body></html>',
                );
            });

            await new Promise<void>(resolve => flakyResourceServer.listen(0, resolve));
            const port = (flakyResourceServer.address() as AddressInfo).port;
            const flakyUrl = `http://localhost:${port}/`;

            try {
                const result = await navigate.cb({ url: flakyUrl, timeout: 5000 }, browser);

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain(`Successfully navigated to ${flakyUrl}`);
            } finally {
                await new Promise<void>(resolve => flakyResourceServer.close(() => resolve()));
            }
        });

        describe("timeout behavior", () => {
            it("should omit timeout from generated testplane code when not provided", async () => {
                const result = await navigate.cb({ url: playgroundUrl }, browser);

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain(`await browser.openAndWait("${playgroundUrl}");`);
                expect(text).not.toContain('"timeout"');
            });

            it("should include timeout in generated testplane code when provided", async () => {
                const result = await navigate.cb({ url: playgroundUrl, timeout: 5000 }, browser);

                expect(result.isError).toBe(false);
                const text = getTextContent(result);
                expect(text).toContain(`await browser.openAndWait("${playgroundUrl}", {"timeout":5000});`);
            });

            it("should respect custom timeout when the page never finishes loading", async () => {
                const slowServer = http.createServer((_req, res) => {
                    // Hold the response open — never finish so the navigation hits timeout.
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.write("<!doctype html><html><head><title>slow</title></head><body>");
                    // Intentionally do NOT call res.end() so the response stays pending.
                });

                await new Promise<void>(resolve => slowServer.listen(0, resolve));
                const port = (slowServer.address() as AddressInfo).port;
                const slowUrl = `http://localhost:${port}/`;

                try {
                    const startTime = Date.now();
                    const result = await navigate.cb({ url: slowUrl, timeout: 1500 }, browser);
                    const elapsedTime = Date.now() - startTime;

                    expect(result.isError).toBe(true);
                    const text = getTextContent(result);
                    expect(text).toContain("Failed to load http://localhost");
                    expect(text).toContain(
                        "in 1500ms. You can increase the wait time by setting a higher timeout value when calling this tool",
                    );

                    expect(elapsedTime).toBeGreaterThan(1400);
                    expect(elapsedTime).toBeLessThan(7000);
                } finally {
                    await new Promise<void>(resolve => slowServer.close(() => resolve()));
                }
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
