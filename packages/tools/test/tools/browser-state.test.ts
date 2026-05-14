import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WdioBrowser } from "testplane";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

import { restoreState, saveState } from "../../src/tools/browser-state.js";
import { PlaygroundServer } from "../test-server.js";
import { launchHeadlessBrowser, getTextContent } from "../setup.js";
import { INTEGRATION_TEST_TIMEOUT } from "../constants.js";

describe(
    "tools/browser-state",
    () => {
        let browser: WdioBrowser;
        let testServer: PlaygroundServer;
        let playgroundUrl: string;
        let tempDir: string;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
            browser = await launchHeadlessBrowser();
            tempDir = await mkdtemp(path.join(os.tmpdir(), "testplane-mcp-state-"));
        }, 20000);

        afterAll(async () => {
            if (browser) await browser.deleteSession();
            if (testServer) await testServer.stop();
            if (tempDir) await rm(tempDir, { recursive: true, force: true });
        });

        beforeEach(async () => {
            await browser.url(playgroundUrl);
            await clearBrowserState(browser);
        });

        it("saves and restores cookies, localStorage, and sessionStorage from a file", async () => {
            const statePath = path.join(tempDir, "full-state.json");

            await setBrowserState(browser, {
                cookie: "saved-cookie",
                localStorage: "saved-local",
                sessionStorage: "saved-session",
            });

            const saveResult = await saveState.cb({ path: statePath }, browser);
            expect(saveResult.isError).toBe(false);
            expect(getTextContent(saveResult)).toContain(`Saved browser state to ${statePath}`);

            await clearBrowserState(browser);
            await expect(readBrowserState(browser)).resolves.toEqual({
                cookie: "",
                localStorage: null,
                sessionStorage: null,
            });

            const restoreResult = await restoreState.cb({ path: statePath }, browser);
            expect(restoreResult.isError).toBe(false);

            const text = getTextContent(restoreResult);
            expect(text).toContain(`Restored browser state from ${statePath}`);
            expect(text).toContain("Refresh: enabled - the current page was reloaded after restore");

            expect(await readBrowserState(browser)).toEqual({
                cookie: "saved-cookie",
                localStorage: "saved-local",
                sessionStorage: "saved-session",
            });
        });

        it("can skip selected state kinds when saving", async () => {
            const statePath = path.join(tempDir, "storage-only-state.json");

            await setBrowserState(browser, {
                cookie: "excluded-cookie",
                localStorage: "included-local",
                sessionStorage: "excluded-session",
            });

            const result = await saveState.cb(
                {
                    path: statePath,
                    cookies: false,
                    localStorage: true,
                    sessionStorage: false,
                },
                browser,
            );

            expect(result.isError).toBe(false);

            const savedState = JSON.parse(await readFile(statePath, "utf8")) as {
                cookies?: unknown[];
                framesData: Record<string, { localStorage?: Record<string, string>; sessionStorage?: unknown }>;
            };
            const frameData = savedState.framesData[new URL(playgroundUrl).origin];

            expect(savedState.cookies).toBeUndefined();
            expect(frameData.localStorage).toEqual({ mcpLocalState: "included-local" });
            expect(frameData.sessionStorage).toBeUndefined();
        });

        it("writes an empty state file", async () => {
            const statePath = path.join(tempDir, "empty-state.json");

            const result = await saveState.cb(
                {
                    path: statePath,
                    cookies: false,
                    localStorage: false,
                    sessionStorage: false,
                },
                browser,
            );

            expect(result.isError).toBe(false);
            expect(JSON.parse(await readFile(statePath, "utf8"))).toEqual({ framesData: {} });
        });

        it("surfaces invalid restore files as tool errors", async () => {
            const statePath = path.join(tempDir, "invalid-state.json");
            await writeFile(statePath, "{not-json", "utf8");

            const result = await restoreState.cb({ path: statePath }, browser);

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("Error restoring browser state");
        });

        it("explains that a real page must be opened before saving state", async () => {
            await browser.url("about:blank");

            const result = await saveState.cb({ path: path.join(tempDir, "about-blank-state.json") }, browser);

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("Before saveState first open page using url command");
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);

async function setBrowserState(
    browser: WdioBrowser,
    values: { cookie: string; localStorage: string; sessionStorage: string },
): Promise<void> {
    await browser.execute((state: typeof values) => {
        document.cookie = `mcpState=${state.cookie}; path=/`;
        window.localStorage.setItem("mcpLocalState", state.localStorage);
        window.sessionStorage.setItem("mcpSessionState", state.sessionStorage);
    }, values);
}

async function clearBrowserState(browser: WdioBrowser): Promise<void> {
    await browser.execute(() => {
        document.cookie = "mcpState=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        window.localStorage.clear();
        window.sessionStorage.clear();
    });
}

async function readBrowserState(browser: WdioBrowser): Promise<{
    cookie: string;
    localStorage: string | null;
    sessionStorage: string | null;
}> {
    return browser.execute(() => {
        const cookie =
            document.cookie
                .split("; ")
                .find(value => value.startsWith("mcpState="))
                ?.slice("mcpState=".length) ?? "";

        return {
            cookie,
            localStorage: window.localStorage.getItem("mcpLocalState"),
            sessionStorage: window.sessionStorage.getItem("mcpSessionState"),
        };
    });
}
