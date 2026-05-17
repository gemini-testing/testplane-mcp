import type { BrowserSession, CaptureDomSnapshotResult, CaptureSnapshotOptions } from "./types.js";
import type { EvaluateResult, ReplConnection } from "./repl-connection.js";

export interface ReplBrowserConnection {
    send(code: string): Promise<EvaluateResult>;
    sendRaw(code: string): Promise<string>;
    close(): Promise<void>;
}

export interface ReplCodeRunner {
    runCodeInRepl(source: string): Promise<string>;
}

export function isReplCodeRunner(browser: unknown): browser is ReplCodeRunner {
    return (
        Boolean(browser) &&
        typeof browser === "object" &&
        typeof (browser as { runCodeInRepl?: unknown }).runCodeInRepl === "function"
    );
}

function errorFromEvaluation(error: unknown): Error {
    if (error && typeof error === "object") {
        const record = error as Record<string, unknown>;
        const message = typeof record.message === "string" ? record.message : JSON.stringify(record);
        const result = new Error(message);

        if (typeof record.name === "string") {
            result.name = record.name;
        }

        if (typeof record.stack === "string") {
            result.stack = record.stack;
        }

        return result;
    }

    return new Error(String(error));
}

export class ReplBrowser implements BrowserSession {
    private readonly _connection: ReplBrowserConnection;

    constructor(connection: ReplConnection | ReplBrowserConnection) {
        this._connection = connection;
    }

    public async getWindowHandles(): Promise<string[]> {
        return this._evaluate<string[]>("await browser.getWindowHandles()");
    }

    public async getWindowHandle(): Promise<string> {
        return this._evaluate<string>("await browser.getWindowHandle()");
    }

    public async switchToWindow(handle: string): Promise<void> {
        await this._evaluate(`await browser.switchToWindow(${JSON.stringify(handle)})`);
    }

    public async getTitle(): Promise<string> {
        return this._evaluate<string>("await browser.getTitle()");
    }

    public async getUrl(): Promise<string> {
        return this._evaluate<string>("await browser.getUrl()");
    }

    public async getPageSource(): Promise<string> {
        return this._evaluate<string>("await browser.getPageSource()");
    }

    public async unstable_captureDomSnapshot(options?: CaptureSnapshotOptions): Promise<CaptureDomSnapshotResult> {
        return this._evaluate<CaptureDomSnapshotResult>(
            `await browser.unstable_captureDomSnapshot(${JSON.stringify(options)})`,
        );
    }

    public async close(): Promise<void> {
        await this._connection.close();
    }

    public async deleteSession(): Promise<void> {
        await this.close();
    }

    public async runCodeInRepl(source: string): Promise<string> {
        return this._connection.sendRaw(source);
    }

    private async _evaluate<T = unknown>(code: string): Promise<T> {
        const result = await this._connection.send(code);
        if (result.ok) {
            return result.value as T;
        }

        throw errorFromEvaluation(result.error);
    }
}
