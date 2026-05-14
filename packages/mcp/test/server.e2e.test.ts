import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { startClient, E2E_TEST_TIMEOUT } from "./utils.js";
import { PlaygroundServer } from "./test-server.js";

const EXPECTED_TOOL_NAMES = [
    // action tools
    "navigate",
    "click",
    "hover",
    "type",
    "select",
    "wait",
    "snapshot",
    "screenshot",
    "console",
    "list-tabs",
    "switch-tab",
    "new-tab",
    "close-tab",
    "save-state",
    "restore-state",
    // report tools
    "test-results",
    "inspect-result",
    "time-travel-snapshot",
    // session tools
    "launch",
    "attach",
    "attach-repl",
    "close-browser",
    // advanced tools
    "run-code",
];

describe(
    "mcp server e2e",
    () => {
        let client: Client;
        let testServer: PlaygroundServer;
        let playgroundUrl: string;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
            client = await startClient();
        }, E2E_TEST_TIMEOUT);

        afterAll(async () => {
            if (client) await client.close();
            if (testServer) await testServer.stop();
        });

        it("registers every tool with MCP", async () => {
            const { tools } = await client.listTools();
            const names = tools.map(t => t.name).sort();
            expect(names).toEqual([...EXPECTED_TOOL_NAMES].sort());
        });

        it("requires an active browser for non-navigate action tools", async () => {
            const result = await client.callTool({
                name: "click",
                arguments: {
                    selector: "#btn",
                },
            });
            expect(result.isError).toBe(true);

            const content = result.content as Array<{ type: string; text: string }>;
            const text = content.map(c => c.text).join("\n");
            expect(text).toContain("No active browser session");
        });

        it("auto-launches the browser on first action tool call", async () => {
            const result = await client.callTool({ name: "navigate", arguments: { url: playgroundUrl } });
            expect(result.isError).toBe(false);

            const content = result.content as Array<{ type: string; text: string }>;
            const text = content.map(c => c.text).join("\n");
            expect(text).toContain(`Successfully navigated to ${playgroundUrl}`);

            const snapshotPathMatch = text.match(/(?:Saved to:|The snapshot was saved to:) (\S+\.(?:yml|html))/);
            expect(snapshotPathMatch, "navigate response should reference a saved snapshot file").not.toBeNull();
            const snapshotContent = fs.readFileSync(snapshotPathMatch![1], "utf8");
            expect(snapshotContent).toContain("server-wiring-ok");
        });

        it("closeBrowser ends the session cleanly", async () => {
            const result = await client.callTool({ name: "close-browser", arguments: {} });
            expect(result.isError).toBe(false);

            const content = result.content as Array<{ type: string; text: string }>;
            const text = content.map(c => c.text).join("\n");
            expect(text.toLowerCase()).toContain("browser session closed");
        });

        it("re-auto-launches after a closeBrowser", async () => {
            const result = await client.callTool({ name: "navigate", arguments: { url: playgroundUrl } });
            expect(result.isError).toBe(false);
        });

        it("returns browser-side console messages from a real page", async () => {
            const consolePageUrl = `${playgroundUrl}/console.html`;
            const navigateResult = await client.callTool({ name: "navigate", arguments: { url: consolePageUrl } });
            expect(navigateResult.isError).toBe(false);

            const result = await client.callTool({ name: "console", arguments: {} });
            expect(result.isError).toBe(false);

            const content = result.content as Array<{ type: string; text: string }>;
            const text = content.map(c => c.text).join("\n");
            expect(text).toContain("Retrieved");
            expect(text).toContain('const consoleMessages = await browser.getLogs("browser");');
            expect(text).toContain("testplane-mcp-console-e2e warning");
            expect(text).toContain("testplane-mcp-console-e2e error");
        });

        it("surfaces tool-level errors as isError responses", async () => {
            const result = await client.callTool({
                name: "click",
                arguments: {
                    selector: "#does-not-exist-1234",
                },
            });
            expect(result.isError).toBe(true);
        });
    },
    E2E_TEST_TIMEOUT,
);
