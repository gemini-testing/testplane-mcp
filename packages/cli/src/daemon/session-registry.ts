import type { WdioBrowser } from "testplane";
import type { BrowserOptions } from "@testplane/tools";

import makeDebug from "debug";

const debug = makeDebug("testplane-cli:daemon:session-registry");

export interface SessionState {
    browser: WdioBrowser | null;
    options: BrowserOptions;
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

    constructor(defaultOptions: BrowserOptions) {
        this._defaultOptions = defaultOptions;
    }

    public getOrCreate(sessionName: string): SessionState {
        let state = this._sessions.get(sessionName);
        if (!state) {
            state = { browser: null, options: { ...this._defaultOptions } };
            this._sessions.set(sessionName, state);
        }

        return state;
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
                state.browser = null;
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

            state.browser = null;
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
