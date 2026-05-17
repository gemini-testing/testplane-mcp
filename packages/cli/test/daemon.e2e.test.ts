import os from "os";
import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { WdioBrowser } from "testplane";
import { launchBrowser } from "testplane/unstable";

import { PlaygroundServer } from "./test-server.js";
import { runCli } from "./utils.js";

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
type BrowserWithDriverPid = WdioBrowser & {
    getDriverPid?: () => number | undefined | Promise<number | undefined>;
};

async function waitFor(predicate: () => boolean, timeoutMs: number, intervalMs = 100): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) {
            return;
        }

        await sleep(intervalMs);
    }

    if (!predicate()) {
        throw new Error(`condition not met within ${timeoutMs}ms`);
    }
}

function checkProcessExists(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function killProcessIfRunning(pid: number): void {
    if (!checkProcessExists(pid)) {
        return;
    }

    process.kill(pid, "SIGKILL");
}

function toAttachSession(browser: WdioBrowser, driverPid: number) {
    const sessionCaps = browser.capabilities as {
        browserName: string;
        browserVersion: string;
        setWindowRect: boolean;
    };
    const sessionOpts = browser.options as {
        protocol: string;
        hostname: string;
        port: number;
        path: string;
    };

    expect(sessionCaps.browserName).toBeTypeOf("string");
    expect(sessionCaps.browserVersion).toBeTypeOf("string");
    expect(sessionCaps.setWindowRect).toBeTypeOf("boolean");
    expect(sessionOpts.protocol).toBeTypeOf("string");
    expect(sessionOpts.hostname).toBeTypeOf("string");
    expect(sessionOpts.port).toBeTypeOf("number");
    expect(sessionOpts.path).toBeTypeOf("string");

    return {
        sessionId: browser.sessionId,
        driverPid,
        sessionCaps,
        sessionOpts,
    };
}

describe("daemon e2e", () => {
    let playgroundUrl: string;
    let testServer: PlaygroundServer;
    let socketPath: string;
    let extraEnv: Record<string, string>;

    beforeAll(async () => {
        testServer = new PlaygroundServer();
        playgroundUrl = await testServer.start();

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "testplane-cli-e2e-"));
        socketPath = path.join(tmpDir, "test.sock");
        extraEnv = {
            TESTPLANE_CLI_SOCKET_OVERRIDE: socketPath,
            TESTPLANE_CLI_DAEMON_IDLE_MS: "2000",
            TESTPLANE_CLI_HEADLESS: "1",
            DISABLE_BROWSER_SANDBOX: "1",
        };
    });

    afterAll(async () => {
        // Attempt to tear down the daemon if still alive.
        if (fs.existsSync(socketPath)) {
            await runCli(["close-browser"], extraEnv).catch(() => {});
        }

        if (testServer) {
            await testServer.stop();
        }

        // Clean up tmp dir.
        try {
            fs.rmSync(path.dirname(socketPath), { recursive: true, force: true });
        } catch (e) {
            // cleanup best-effort
            void e;
        }
    });

    it("spawns the daemon on first command and returns a tool response", async () => {
        const r = await runCli(["close-browser"], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("No active browser session to close");
    });

    it("resolves run-code --file relative to the current CLI invocation", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "testplane-cli-run-code-cwd-"));
        const daemonCwd = path.join(tmpDir, "daemon-cwd");
        const callerCwd = path.join(tmpDir, "caller-cwd");
        const runCodeEnv = {
            ...extraEnv,
            TESTPLANE_CLI_SOCKET_OVERRIDE: path.join(tmpDir, "run-code-cwd.sock"),
        };

        fs.mkdirSync(daemonCwd);
        fs.mkdirSync(callerCwd);
        fs.writeFileSync(path.join(daemonCwd, "script.js"), '"daemon-cwd";');
        fs.writeFileSync(path.join(callerCwd, "script.js"), '"caller-cwd";');

        try {
            const spawnResp = await runCli(["close-browser"], runCodeEnv, daemonCwd);
            expect(spawnResp.code).toBe(0);

            const runResp = await runCli(["run-code", "--file", "./script.js"], runCodeEnv, callerCwd);
            expect(runResp.code).toBe(0);
            expect(runResp.stdout).toContain('"caller-cwd"');
            expect(runResp.stdout).not.toContain('"daemon-cwd"');
        } finally {
            await runCli(["close-browser"], runCodeEnv, callerCwd).catch(() => {});
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("navigates to the playground page", async () => {
        const r = await runCli(["navigate", playgroundUrl], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain(`Successfully navigated to ${playgroundUrl}`);

        const snapshotPathMatch = r.stdout.match(/The snapshot was saved to: (\S+\.(?:yml|html))/);
        expect(snapshotPathMatch, "navigate response should reference a saved snapshot file").not.toBeNull();
        const snapshotContent = fs.readFileSync(snapshotPathMatch![1], "utf8");
        expect(snapshotContent).toContain("e2e-ok");
    });

    it("clicks an element by CSS selector", async () => {
        const r = await runCli(["click", "#btn"], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("Successfully clicked element");
    });

    it("selects a native option by value", async () => {
        const r = await runCli(["select", "#country", "--value", "jp"], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('Successfully selected option by value "jp"');

        const snapshotPathMatch = r.stdout.match(/The snapshot was saved to: (\S+\.(?:yml|html))/);
        expect(snapshotPathMatch, "select response should reference a saved snapshot file").not.toBeNull();
        const snapshotContent = fs.readFileSync(snapshotPathMatch![1], "utf8");
        expect(snapshotContent).toContain("selected:jp");
    });

    it("returns browser-side console messages from a real page", async () => {
        const navigateResp = await runCli(["navigate", `${playgroundUrl}/console.html`], extraEnv);
        expect(navigateResp.code).toBe(0);
        expect(navigateResp.stdout).toContain(`Successfully navigated to ${playgroundUrl}/console.html`);

        const r = await runCli(["console"], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("Retrieved");
        expect(r.stdout).toContain('const consoleMessages = await browser.getLogs("browser");');
        expect(r.stdout).toContain("testplane-console-e2e warning");
        expect(r.stdout).toContain("testplane-console-e2e error");
    });

    it("states the Chromium browser limitation in console help", async () => {
        const r = await runCli(["console", "--help"], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("Chromium-based");
    });

    it("shows select examples in help", async () => {
        const r = await runCli(["select", "--help"], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("Examples:");
        expect(r.stdout).toContain('testplane-cli select "#country" --visible-text "Germany"');
        expect(r.stdout).toContain("--visible-text <value>");
        expect(r.stdout).toContain("--index <value>");
        expect(r.stdout).toContain("--value <value>");
    });

    it("returns exit 1 and error text for a missing element", async () => {
        const r = await runCli(["click", "#no-such-element-xyz"], extraEnv);
        expect(r.code).toBe(1);
        expect(r.stdout).toMatch(/not found|Unable to find|wasn't found/i);
    });

    it("close-browser ends the session and the response is on stdout", async () => {
        const r = await runCli(["close-browser"], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("Browser session closed successfully");
    });

    it("daemon exits after idle TTL and socket is removed", async () => {
        // No live sessions after close-browser above → idle timer armed at 2 s.
        await new Promise(r => setTimeout(r, 3000));
        expect(fs.existsSync(socketPath)).toBe(false);
    });

    it("re-spawns daemon on next command after idle exit", async () => {
        const r = await runCli(["close-browser"], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("No active browser session to close");
        expect(fs.existsSync(socketPath)).toBe(true);
    });

    it("expires a browser session after a configurable inactivity timeout", async () => {
        const sessionEnv = {
            ...extraEnv,
            TESTPLANE_CLI_SOCKET_OVERRIDE: path.join(path.dirname(socketPath), "session-timeout.sock"),
            TESTPLANE_CLI_SESSION_TTL_MS: "1000",
        };

        const navigateResp = await runCli(["navigate", playgroundUrl], sessionEnv);
        expect(navigateResp.code).toBe(0);
        expect(navigateResp.stdout).toContain(`Successfully navigated to ${playgroundUrl}`);

        await sleep(1500);

        const closeResp = await runCli(["close-browser"], sessionEnv);
        expect(closeResp.code).toBe(0);
        expect(closeResp.stdout).toContain("No active browser session to close");
    });

    it("exits after idle TTL when attached browser dies externally", async () => {
        let externalBrowser: BrowserWithDriverPid | null = null;

        try {
            externalBrowser = (await launchBrowser({
                headless: "new",
                desiredCapabilities: {
                    "goog:chromeOptions": {
                        args:
                            extraEnv.DISABLE_BROWSER_SANDBOX === "1" ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
                    },
                },
            })) as BrowserWithDriverPid;

            const driverPid = await externalBrowser.getDriverPid?.();
            expect(driverPid).toBeTypeOf("number");
            const attachSession = toAttachSession(externalBrowser, driverPid as number);

            const attachResp = await runCli(
                ["--session-name", "stale-attach", "attach", "--session", JSON.stringify(attachSession)],
                extraEnv,
            );
            expect(attachResp.code).toBe(0);
            expect(attachResp.stdout).toContain("Successfully attached to existing browser session");

            killProcessIfRunning(driverPid as number);

            await waitFor(() => !checkProcessExists(driverPid as number), 5000, 50);
            externalBrowser = null;
            await waitFor(() => !fs.existsSync(socketPath), 30000, 100);
        } finally {
            if (externalBrowser) {
                try {
                    await externalBrowser.deleteSession();
                } catch {
                    // expected when the browser process was killed externally
                }
            }
        }
    });

    it("routes a named --session-name to a separate session state", async () => {
        // The default session has no browser; foo session also has none.
        const r = await runCli(["--session-name", "foo", "close-browser"], extraEnv);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("No active browser session to close");
    });
});
