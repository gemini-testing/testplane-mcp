import { describe, expect, it, vi } from "vitest";
import { ReplBrowser, type ReplBrowserConnection } from "../../src/browser/repl-browser.js";

function createConnection(value: unknown): ReplBrowserConnection {
    return {
        send: vi.fn().mockResolvedValue({ ok: true, value }),
        sendRaw: vi.fn().mockResolvedValue("raw output"),
        close: vi.fn().mockResolvedValue(undefined),
    };
}

describe("browser/ReplBrowser", () => {
    it("sends the expected expressions for browser state methods", async () => {
        const connection = createConnection("value");
        const browser = new ReplBrowser(connection);

        await browser.getUrl();
        await browser.getTitle();
        await browser.getWindowHandle();
        await browser.getWindowHandles();
        await browser.getPageSource();
        await browser.switchToWindow("handle-1");

        expect(connection.send).toHaveBeenNthCalledWith(1, "await browser.getUrl()");
        expect(connection.send).toHaveBeenNthCalledWith(2, "await browser.getTitle()");
        expect(connection.send).toHaveBeenNthCalledWith(3, "await browser.getWindowHandle()");
        expect(connection.send).toHaveBeenNthCalledWith(4, "await browser.getWindowHandles()");
        expect(connection.send).toHaveBeenNthCalledWith(5, "await browser.getPageSource()");
        expect(connection.send).toHaveBeenNthCalledWith(6, 'await browser.switchToWindow("handle-1")');
    });

    it("sends snapshot options as a JSON argument", async () => {
        const snapshot = {
            snapshot: "root:",
            omittedTags: [],
            omittedAttributes: [],
            textWasTruncated: false,
        };
        const connection = createConnection(snapshot);
        const browser = new ReplBrowser(connection);

        await browser.unstable_captureDomSnapshot({ includeTags: ["main"], truncateText: false });

        expect(connection.send).toHaveBeenCalledWith(
            'await browser.unstable_captureDomSnapshot({"includeTags":["main"],"truncateText":false})',
        );
    });

    it("throws evaluation errors returned by the REPL", async () => {
        const connection: ReplBrowserConnection = {
            send: vi.fn().mockResolvedValue({
                ok: false,
                error: { name: "Error", message: "boom", stack: "Error: boom" },
            }),
            sendRaw: vi.fn().mockResolvedValue("raw output"),
            close: vi.fn().mockResolvedValue(undefined),
        };
        const browser = new ReplBrowser(connection);

        await expect(browser.getUrl()).rejects.toThrow("boom");
    });

    it("passes run-code source through the raw REPL channel", async () => {
        const connection = createConnection("value");
        const browser = new ReplBrowser(connection);

        await expect(browser.runCodeInRepl("const url = await browser.getUrl();")).resolves.toBe("raw output");
        expect(connection.sendRaw).toHaveBeenCalledWith("const url = await browser.getUrl();");
    });
});
