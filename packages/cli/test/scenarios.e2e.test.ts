import os from "os";
import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { PlaygroundServer } from "./test-server.js";
import { runCli } from "./utils.js";

let playgroundUrl: string;
let testServer: PlaygroundServer;
let extraEnv: Record<string, string>;

async function cli(...args: string[]): Promise<{ out: string; err: string; code: number }> {
    const r = await runCli(args, extraEnv);
    return { out: r.stdout, err: r.stderr, code: r.code };
}

describe("CLI user scenarios", () => {
    beforeAll(async () => {
        testServer = new PlaygroundServer();
        playgroundUrl = await testServer.start();

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "testplane-cli-scenarios-"));
        extraEnv = {
            TESTPLANE_CLI_SOCKET_OVERRIDE: path.join(tmpDir, "test.sock"),
            TESTPLANE_CLI_DAEMON_IDLE_MS: "30000",
            DISABLE_BROWSER_SANDBOX: "1",
        };
    });

    afterAll(async () => {
        await cli("close-browser").catch(() => {});
        if (testServer) await testServer.stop();
    });

    it("should navigate and inspect the page via DOM snapshot", async () => {
        const nav = await cli("navigate", playgroundUrl);
        expect(nav.code).toBe(0);
        expect(nav.out).toContain("Successfully navigated");

        const snap = await cli("snapshot");
        expect(snap.code).toBe(0);

        expect(snap.out).toContain("CLI E2E Playground");
        expect(snap.out).toContain("e2e-ok");
        expect(snap.out).toContain("Submit order");
        expect(snap.out).toContain("type here");
    });

    it("should click a button by ARIA role and verify the DOM changes", async () => {
        await cli("navigate", playgroundUrl);

        const click = await cli("click", "--role", "button", "--name", "Submit order");
        expect(click.code).toBe(0);
        expect(click.out).toContain("Successfully clicked element");

        const snap = await cli("snapshot");
        expect(snap.code).toBe(0);
        expect(snap.out).toContain("clicked");
    });

    it("should type text into a field located by label", async () => {
        await cli("navigate", playgroundUrl);

        const type = await cli("type", "--label-text", "Search", "--value", "testplane rocks");
        expect(type.code).toBe(0);
        expect(type.out).toContain('Successfully typed "testplane rocks"');
    });

    it("should open a second tab, inspect the tab list, then close it", async () => {
        await cli("navigate", playgroundUrl);

        const newTab = await cli("new-tab", `${playgroundUrl}/page2.html`);
        expect(newTab.code).toBe(0);

        const list1 = await cli("list-tabs");
        expect(list1.code).toBe(0);
        expect(list1.out).toContain("1.");
        expect(list1.out).toContain("2.");
        expect(list1.out).toContain("page2");

        const close = await cli("close-tab", "2");
        expect(close.code).toBe(0);

        const list2 = await cli("list-tabs");
        expect(list2.code).toBe(0);
        expect(list2.out).not.toContain("page2");
        expect(list2.out).toContain("1.");

        expect(list2.out).not.toContain("2.");
    });

    it("should take a viewport screenshot and get back the saved file path", async () => {
        await cli("navigate", playgroundUrl);

        const shot = await cli("screenshot");
        expect(shot.code).toBe(0);

        expect(shot.out).toContain("Screenshot saved:");
        expect(shot.out).toContain(".png");

        const match = shot.out.match(/Screenshot saved: (.+\.png)/);
        expect(match).not.toBeNull();
        const filePath = match![1].trim().split(" ")[0];
        expect(fs.existsSync(filePath)).toBe(true);
    });
});
