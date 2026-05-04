import { describe, it, expect, afterEach, vi } from "vitest";
import type { WdioBrowser } from "testplane";

import { SessionRegistry } from "../../src/daemon/session-registry.js";
import { DEFAULT_SESSION_TTL_MS, parseSessionTtlMs } from "../../src/session-timeout.js";

function createBrowser(): WdioBrowser & { deleteSession: ReturnType<typeof vi.fn> } {
    return {
        deleteSession: vi.fn().mockResolvedValue(undefined),
        getUrl: vi.fn().mockResolvedValue("about:blank"),
    } as unknown as WdioBrowser & { deleteSession: ReturnType<typeof vi.fn> };
}

describe("daemon/SessionRegistry", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("expires a browser session after its inactivity timeout", async () => {
        vi.useFakeTimers();
        const sessions = new SessionRegistry({}, { sessionTtlMs: 1000 });
        const browser = createBrowser();

        const state = sessions.beginInteraction("default");
        state.browser = browser;
        sessions.endInteraction("default", state);

        await vi.advanceTimersByTimeAsync(999);
        expect(browser.deleteSession).not.toHaveBeenCalled();
        expect(state.browser).toBe(browser);

        await vi.advanceTimersByTimeAsync(1);
        expect(browser.deleteSession).toHaveBeenCalledTimes(1);
        expect(state.browser).toBeNull();
    });

    it("resets the inactivity timeout when the session is touched again", async () => {
        vi.useFakeTimers();
        const sessions = new SessionRegistry({}, { sessionTtlMs: 1000 });
        const browser = createBrowser();

        const state = sessions.beginInteraction("default");
        state.browser = browser;
        sessions.endInteraction("default", state);

        await vi.advanceTimersByTimeAsync(600);
        const sameState = sessions.beginInteraction("default");
        sessions.endInteraction("default", sameState);

        await vi.advanceTimersByTimeAsync(999);
        expect(browser.deleteSession).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(browser.deleteSession).toHaveBeenCalledTimes(1);
    });

    it("uses the configured session timeout", async () => {
        vi.useFakeTimers();
        const sessions = new SessionRegistry({}, { sessionTtlMs: 250 });
        const browser = createBrowser();

        const state = sessions.beginInteraction("default");
        state.browser = browser;
        sessions.endInteraction("default", state);

        await vi.advanceTimersByTimeAsync(249);
        expect(browser.deleteSession).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(browser.deleteSession).toHaveBeenCalledTimes(1);
    });
});

describe("parseSessionTtlMs", () => {
    it("defaults to 5 minutes", () => {
        expect(parseSessionTtlMs(undefined)).toBe(DEFAULT_SESSION_TTL_MS);
        expect(parseSessionTtlMs("")).toBe(DEFAULT_SESSION_TTL_MS);
        expect(DEFAULT_SESSION_TTL_MS).toBe(5 * 60 * 1000);
    });

    it("accepts only positive integer millisecond values", () => {
        expect(parseSessionTtlMs("1000")).toBe(1000);
        expect(() => parseSessionTtlMs("0")).toThrow();
        expect(() => parseSessionTtlMs("1.5")).toThrow();
        expect(() => parseSessionTtlMs("1e3")).toThrow();
        expect(() => parseSessionTtlMs("1000ms")).toThrow();
    });
});
