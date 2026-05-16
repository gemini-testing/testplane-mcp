import type { WdioBrowser } from "testplane";
import type { BrowserOptions } from "@testplane/tools";

import makeDebug from "debug";

const debug = makeDebug("testplane-cli:daemon:session-registry");

export interface SessionState {
    browser: WdioBrowser | null;
    options: BrowserOptions;
    activeInteractions: number;
    expirationTimer: NodeJS.Timeout | null;
}

export interface SessionRegistryOptions {
    sessionTtlMs: number;
}

function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

export class SessionRegistry {
    private readonly _sessions = new Map<string, SessionState>();
    private readonly _defaultOptions: BrowserOptions;
    private readonly _sessionTtlMs: number;

    constructor(defaultOptions: BrowserOptions, options: SessionRegistryOptions) {
        this._defaultOptions = defaultOptions;
        this._sessionTtlMs = options.sessionTtlMs;
    }

    public getOrCreate(sessionName: string): SessionState {
        let state = this._sessions.get(sessionName);
        if (!state) {
            state = {
                browser: null,
                options: { ...this._defaultOptions },
                activeInteractions: 0,
                expirationTimer: null,
            };
            this._sessions.set(sessionName, state);
        }

        return state;
    }

    public beginInteraction(sessionName: string): SessionState {
        const state = this.getOrCreate(sessionName);

        state.activeInteractions += 1;
        this._cancelExpirationTimer(sessionName, state);

        return state;
    }

    public endInteraction(sessionName: string, state: SessionState): void {
        state.activeInteractions = Math.max(0, state.activeInteractions - 1);
        this._scheduleExpirationTimer(sessionName, state);
    }

    public clearBrowser(sessionName: string, state: SessionState): void {
        state.browser = null;
        this._cancelExpirationTimer(sessionName, state);
    }

    public hasLive(): boolean {
        for (const state of this._sessions.values()) {
            if (state.browser) {
                return true;
            }
        }

        return false;
    }

    public async clearStale(): Promise<void> {
        for (const [sessionName, state] of this._sessions) {
            const browser = state.browser;
            if (!browser) {
                continue;
            }

            const isAlive = await this._isSessionAlive(sessionName, browser);
            if (isAlive) {
                continue;
            }

            if (state.browser !== browser) {
                continue;
            }

            debug("Stale session detected, clearing: session=%s", sessionName);

            try {
                await browser.deleteSession();
            } catch (error) {
                debug("Stale session cleanup error: session=%s message=%s", sessionName, formatError(error));
            }

            if (state.browser === browser) {
                this.clearBrowser(sessionName, state);
            }
        }
    }

    public async cleanupAll(): Promise<void> {
        for (const [sessionName, state] of this._sessions) {
            if (!state.browser) {
                continue;
            }

            debug("Closing session: session=%s", sessionName);

            try {
                await state.browser.deleteSession();
            } catch (error) {
                debug("Session cleanup error: session=%s message=%s", sessionName, formatError(error));
            }

            this.clearBrowser(sessionName, state);
        }
    }

    private _scheduleExpirationTimer(sessionName: string, state: SessionState): void {
        if (state.expirationTimer || state.activeInteractions > 0 || !state.browser) {
            return;
        }

        const browser = state.browser;

        debug("Session expiration timer armed: session=%s ttlMs=%d", sessionName, this._sessionTtlMs);
        state.expirationTimer = setTimeout(() => {
            void this._expireSession(sessionName, state, browser);
        }, this._sessionTtlMs);
        state.expirationTimer.unref();
    }

    private _cancelExpirationTimer(sessionName: string, state: SessionState): void {
        if (!state.expirationTimer) {
            return;
        }

        debug("Session expiration timer canceled: session=%s", sessionName);
        clearTimeout(state.expirationTimer);
        state.expirationTimer = null;
    }

    private async _expireSession(sessionName: string, state: SessionState, browser: WdioBrowser | null): Promise<void> {
        state.expirationTimer = null;

        if (!browser || state.browser !== browser || state.activeInteractions > 0) {
            this._scheduleExpirationTimer(sessionName, state);

            return;
        }

        debug("Session expiration timer fired: session=%s", sessionName);
        state.browser = null;

        try {
            await browser.deleteSession();
        } catch (error) {
            debug("Session expiration cleanup error: session=%s message=%s", sessionName, formatError(error));
        }
    }

    private async _isSessionAlive(sessionName: string, browser: WdioBrowser): Promise<boolean> {
        try {
            await browser.getUrl();
        } catch (error) {
            debug("Session health check failed: session=%s message=%s", sessionName, formatError(error));

            return false;
        }

        return true;
    }
}
