import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WdioBrowser } from "testplane";
import type { Request } from "../../src/ipc/protocol.js";
import { SessionRegistry } from "../../src/daemon/session-registry.js";
import { RequestHandler } from "../../src/daemon/request-handler.js";

const mockedTools = vi.hoisted(() => {
    const launchBrowserWithOptions = vi.fn();
    const navigateCb = vi.fn();
    const clickCb = vi.fn();
    const snapshotCb = vi.fn();
    const runCodeCb = vi.fn();

    return {
        launchBrowserWithOptions,
        navigateCb,
        clickCb,
        snapshotCb,
        runCodeCb,
    };
});

vi.mock("@testplane/tools", () => {
    const ToolKind = {
        Standalone: "standalone",
        Action: "action",
        SessionOpen: "session-open",
        SessionClose: "session-close",
    };

    return {
        ToolKind,
        launchBrowserWithOptions: mockedTools.launchBrowserWithOptions,
        tools: [
            {
                kind: ToolKind.Action,
                autoLaunchBrowser: true,
                name: "navigate",
                description: "navigate",
                supportedTransports: ["launch-browser"],
                schema: {},
                cb: mockedTools.navigateCb,
            },
            {
                kind: ToolKind.Action,
                name: "click",
                description: "click",
                supportedTransports: ["launch-browser"],
                schema: {},
                cb: mockedTools.clickCb,
            },
            {
                kind: ToolKind.Action,
                name: "snapshot",
                description: "snapshot",
                supportedTransports: ["launch-browser", "attach-repl"],
                schema: {},
                cb: mockedTools.snapshotCb,
            },
            {
                kind: ToolKind.Action,
                name: "run-code",
                description: "run-code",
                supportedTransports: ["launch-browser", "attach-repl"],
                schema: {},
                cb: mockedTools.runCodeCb,
            },
        ],
    };
});

function createRequest(tool: string): Request {
    return {
        id: 1,
        kind: "call",
        tool,
        sessionName: "default",
        args: {},
    };
}

function createBrowser(): WdioBrowser {
    return {
        deleteSession: vi.fn().mockResolvedValue(undefined),
        getUrl: vi.fn().mockResolvedValue("about:blank"),
    } as unknown as WdioBrowser;
}

describe("daemon/RequestHandler", () => {
    let handler: RequestHandler;
    let sessions: SessionRegistry;
    let browser: WdioBrowser;

    beforeEach(() => {
        vi.clearAllMocks();

        handler = new RequestHandler();
        sessions = new SessionRegistry({ headless: true }, { sessionTtlMs: 1000 });
        browser = createBrowser();

        mockedTools.launchBrowserWithOptions.mockResolvedValue(browser);
        mockedTools.navigateCb.mockResolvedValue({ content: [{ type: "text", text: "ok" }], isError: false });
        mockedTools.clickCb.mockResolvedValue({ content: [{ type: "text", text: "ok" }], isError: false });
        mockedTools.snapshotCb.mockResolvedValue({ content: [{ type: "text", text: "ok" }], isError: false });
        mockedTools.runCodeCb.mockResolvedValue({ content: [{ type: "text", text: "ok" }], isError: false });
    });

    it("does not auto-launch browser for action tools that require an existing session", async () => {
        const response = await handler.handleRequest(createRequest("click"), sessions);

        expect(mockedTools.launchBrowserWithOptions).not.toHaveBeenCalled();
        expect(response.kind).toBe("result");
        if (response.kind === "result") {
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("No active browser session");
        }
    });

    it("auto-launches navigate with default options even when custom launch options were used before", async () => {
        const state = sessions.getOrCreate("default");
        state.options = { headless: false };

        const response = await handler.handleRequest(createRequest("navigate"), sessions);

        expect(mockedTools.launchBrowserWithOptions).toHaveBeenCalledTimes(1);
        expect(mockedTools.launchBrowserWithOptions).toHaveBeenCalledWith({ headless: true });
        expect(mockedTools.navigateCb).toHaveBeenCalledWith({}, browser);
        expect(response.kind).toBe("result");
        if (response.kind === "result") {
            expect(response.isError).toBe(false);
        }
    });

    it("returns a clear error for unsupported action tools in REPL sessions", async () => {
        const state = sessions.getOrCreate("default");
        state.browser = browser;
        state.transport = "attach-repl";

        const response = await handler.handleRequest(createRequest("click"), sessions);

        expect(mockedTools.clickCb).not.toHaveBeenCalled();
        expect(response.kind).toBe("result");
        if (response.kind === "result") {
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toBe(
                "Tool 'click' is not yet supported with REPL sessions. Currently supported in REPL mode: snapshot, run-code.",
            );
        }
    });

    it("allows snapshot in REPL sessions", async () => {
        const state = sessions.getOrCreate("default");
        state.browser = browser;
        state.transport = "attach-repl";

        const response = await handler.handleRequest(createRequest("snapshot"), sessions);

        expect(mockedTools.snapshotCb).toHaveBeenCalledWith({}, browser);
        expect(response.kind).toBe("result");
        if (response.kind === "result") {
            expect(response.isError).toBe(false);
        }
    });

    it("allows run-code in REPL sessions", async () => {
        const state = sessions.getOrCreate("default");
        state.browser = browser;
        state.transport = "attach-repl";

        const response = await handler.handleRequest(createRequest("run-code"), sessions);

        expect(mockedTools.runCodeCb).toHaveBeenCalledWith({}, browser);
        expect(response.kind).toBe("result");
        if (response.kind === "result") {
            expect(response.isError).toBe(false);
        }
    });
});
