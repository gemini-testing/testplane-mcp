import makeDebug from "debug";
import { formatError } from "../utils/error.js";

const debug = makeDebug("testplane-cli:daemon:idle-watchdog");

export interface IdleWatchdogOptions {
    idleTtlMs: number;
    /**
     * Invoked once the idle timer fires with zero active connections. The watchdog auto-rearms
     * after the callback resolves; call `stop()` from within the callback (directly or via the
     * shutdown path) to halt the timer permanently.
     */
    onIdleExpired: () => Promise<void> | void;
}

export class IdleWatchdog {
    private readonly _idleTtlMs: number;
    private readonly _onIdleExpired: () => Promise<void> | void;

    private _activeConnections = 0;
    private _idleTimer: NodeJS.Timeout | null = null;
    private _isStopped = false;

    constructor(options: IdleWatchdogOptions) {
        this._idleTtlMs = options.idleTtlMs;
        this._onIdleExpired = options.onIdleExpired;
    }

    public get isIdle(): boolean {
        return !this._isStopped && this._activeConnections === 0;
    }

    public start(): void {
        this._scheduleIdleTimer();
    }

    public stop(): void {
        if (this._isStopped) {
            return;
        }

        this._isStopped = true;
        this._cancelIdleTimer();
    }

    public notifyConnectionAccepted(): void {
        this._activeConnections += 1;
        this._cancelIdleTimer();
        debug("Connection accepted: activeConnections=%d", this._activeConnections);
    }

    public notifyConnectionClosed(): void {
        this._activeConnections = Math.max(0, this._activeConnections - 1);
        debug("Connection closed: activeConnections=%d", this._activeConnections);
        this._scheduleIdleTimer();
    }

    private _cancelIdleTimer(): void {
        if (!this._idleTimer) {
            return;
        }

        debug("Idle timer canceled");
        clearTimeout(this._idleTimer);
        this._idleTimer = null;
    }

    private _scheduleIdleTimer(): void {
        if (this._isStopped) {
            return;
        }

        if (this._activeConnections > 0) {
            return;
        }

        if (this._idleTimer) {
            return;
        }

        debug("Idle timer armed: ttlMs=%d", this._idleTtlMs);
        this._idleTimer = setTimeout(() => {
            void this._handleIdleFire();
        }, this._idleTtlMs);
        this._idleTimer.unref();
    }

    private async _handleIdleFire(): Promise<void> {
        this._idleTimer = null;
        debug("Idle timer fired");

        if (!this.isIdle) {
            this._scheduleIdleTimer();

            return;
        }

        try {
            await this._onIdleExpired();
        } catch (error) {
            debug("Idle callback error: %s", formatError(error));
        }

        this._scheduleIdleTimer();
    }
}
