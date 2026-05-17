import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WdioBrowser } from "testplane";
import { describe, expect, it, vi } from "vitest";

import { runCode } from "../../src/tools/run-code.js";
import type { ReplCodeRunner } from "../../src/browser/repl-browser.js";
import { getTextContent } from "../setup.js";

function parseResponse(result: { content: unknown }): { result?: unknown; error?: { message?: string } } {
    return JSON.parse(getTextContent(result)) as { result?: unknown; error?: { message?: string } };
}

function createBrowser(): WdioBrowser {
    return {
        getUrl: async () => "https://example.test/page",
        getTitle: async () => "Example",
    } as unknown as WdioBrowser;
}

function createReplBrowser(): ReplCodeRunner & { runCodeInRepl: ReturnType<typeof vi.fn> } {
    return {
        runCodeInRepl: vi.fn().mockResolvedValue("https://example.test/page"),
    };
}

describe("tools/run-code", () => {
    it("runs an inline expression with browser in scope", async () => {
        const result = await runCode.cb({ code: "await browser.getUrl()" }, createBrowser());

        expect(result.isError).toBeFalsy();
        expect(parseResponse(result).result).toBe("https://example.test/page");
    });

    it("automatically invokes function input with browser", async () => {
        const result = await runCode.cb({ code: "(b) => b.getTitle()" }, createBrowser());

        expect(result.isError).toBeFalsy();
        expect(parseResponse(result).result).toBe("Example");
    });

    it("runs statement code with explicit return", async () => {
        const result = await runCode.cb(
            { code: 'const url = await browser.getUrl(); return url.replace("/page", "/done");' },
            createBrowser(),
        );

        expect(result.isError).toBeFalsy();
        expect(parseResponse(result).result).toBe("https://example.test/done");
    });

    it("loads code from a relative file path", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "testplane-run-code-"));

        try {
            await fs.writeFile(path.join(tmpDir, "script.js"), "await browser.getUrl();", "utf8");

            const result = await runCode.cb({ file: path.join(tmpDir, "script.js") }, createBrowser());

            expect(result.isError).toBeFalsy();
            expect(parseResponse(result).result).toBe("https://example.test/page");
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true });
        }
    });

    it("passes source directly to the REPL runner when attached through REPL", async () => {
        const browser = createReplBrowser();
        const code = 'const url = await browser.getUrl(); url.replace("/page", "/done")';

        const result = await runCode.cb({ code }, browser);

        expect(result.isError).toBeFalsy();
        expect(browser.runCodeInRepl).toHaveBeenCalledWith(code);
        expect(parseResponse(result).result).toBe("https://example.test/page");
    });

    it("prints thrown errors as json", async () => {
        const result = await runCode.cb({ code: 'throw new Error("boom")' }, createBrowser());

        expect(result.isError).toBe(true);
        expect(parseResponse(result).error?.message).toBe("boom");
    });
});
