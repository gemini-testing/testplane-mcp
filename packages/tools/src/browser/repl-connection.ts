import net from "node:net";
import { randomUUID } from "node:crypto";
import { stripVTControlCharacters } from "node:util";

export type EvaluateResult = { ok: true; value: unknown } | { ok: false; error: unknown };

export interface ReplConnectionOptions {
    host?: string;
    port: number;
    connectTimeoutMs?: number;
    evaluateTimeoutMs?: number;
}

interface PendingEvaluation {
    startMarker: string;
    endMarker: string;
    timeout: NodeJS.Timeout;
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    parse: (payload: string, outputBeforePayload: string) => unknown;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_EVALUATE_TIMEOUT_MS = 30_000;

declare const browser: unknown;

interface ReplThis {
    browser?: unknown;
}

function isEvaluateResult(value: unknown): value is EvaluateResult {
    if (!value || typeof value !== "object") {
        return false;
    }

    const record = value as Record<string, unknown>;
    return record.ok === true || record.ok === false;
}

function parseEvaluateResult(payload: string): EvaluateResult {
    const parsed: unknown = JSON.parse(payload);

    if (!isEvaluateResult(parsed)) {
        throw new Error(`Unexpected REPL evaluation payload: ${payload}`);
    }

    return parsed;
}

function serializeFunctionExpression(fn: (...args: never[]) => unknown): string {
    return JSON.stringify(`(${fn.toString()})`);
}

async function evaluateReplExpression(
    this: ReplThis | undefined,
    source: string,
    startMarker: string,
    endMarker: string,
): Promise<unknown> {
    const inspect = Symbol.for("nodejs.util.inspect.custom");
    const serializeError = (error: unknown): Record<string, unknown> => {
        if (error && typeof error === "object") {
            const errorRecord = error as Record<string, unknown>;

            return {
                name: typeof errorRecord.name === "string" ? errorRecord.name : "Error",
                message: typeof errorRecord.message === "string" ? errorRecord.message : String(error),
                stack: typeof errorRecord.stack === "string" ? errorRecord.stack : undefined,
            };
        }

        return {
            name: "Error",
            message: String(error),
            stack: undefined,
        };
    };
    const resolveBrowser = (): unknown => {
        let scopedBrowser: unknown;

        try {
            scopedBrowser = browser;
        } catch {
            scopedBrowser = undefined;
        }

        if (scopedBrowser != null) {
            return scopedBrowser;
        }

        if (this?.browser != null) {
            return this.browser;
        }

        return undefined;
    };
    const format = (payload: unknown): string => {
        try {
            return startMarker + JSON.stringify(payload) + endMarker;
        } catch (error) {
            return startMarker + JSON.stringify({ ok: false, error: serializeError(error) }) + endMarker;
        }
    };

    try {
        const run = new Function("browser", `return (async () => (${source}))();`) as (
            browserArg: unknown,
        ) => Promise<unknown>;
        const value = await run(resolveBrowser());

        return { [inspect]: () => format({ ok: true, value }) };
    } catch (error) {
        return { [inspect]: () => format({ ok: false, error: serializeError(error) }) };
    }
}

function installBrowserFallback(this: ReplThis | undefined): void {
    let scopedBrowser: unknown;

    try {
        scopedBrowser = browser;
    } catch {
        scopedBrowser = undefined;
    }

    if (scopedBrowser != null || this?.browser == null) {
        return;
    }

    (globalThis as ReplThis).browser = this.browser;
}

export class ReplConnection {
    private readonly _host: string;
    private readonly _port: number;
    private readonly _connectTimeoutMs: number;
    private readonly _evaluateTimeoutMs: number;
    private _socket: net.Socket | null = null;
    private _connectPromise: Promise<void> | null = null;
    private _buffer = "";
    private _pending: PendingEvaluation | null = null;
    private _sendQueue: Promise<void> = Promise.resolve();

    constructor(options: ReplConnectionOptions) {
        this._host = options.host ?? DEFAULT_HOST;
        this._port = options.port;
        this._connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
        this._evaluateTimeoutMs = options.evaluateTimeoutMs ?? DEFAULT_EVALUATE_TIMEOUT_MS;
    }

    public async connect(): Promise<void> {
        if (this._socket && !this._socket.destroyed) {
            return;
        }

        if (this._connectPromise) {
            return this._connectPromise;
        }

        const connectPromise = new Promise<void>((resolve, reject) => {
            const socket = net.createConnection({ host: this._host, port: this._port });
            this._socket = socket;
            socket.setEncoding("utf8");

            const timeout = setTimeout(() => {
                cleanup();
                socket.destroy();
                reject(new Error(`Timed out connecting to Testplane REPL at ${this._host}:${this._port}`));
            }, this._connectTimeoutMs);

            const cleanup = (): void => {
                clearTimeout(timeout);
                socket.off("connect", onConnect);
                socket.off("error", onConnectError);
            };

            const onConnect = (): void => {
                cleanup();
                socket.on("data", data => this._onData(data.toString()));
                socket.on("error", error => this._rejectPending(error));
                socket.on("close", () => {
                    this._socket = null;
                    this._rejectPending(new Error("Testplane REPL connection closed"));
                });
                resolve();
            };

            const onConnectError = (error: Error): void => {
                cleanup();
                socket.destroy();
                this._socket = null;
                reject(error);
            };

            socket.once("connect", onConnect);
            socket.once("error", onConnectError);
        }).finally(() => {
            this._connectPromise = null;
        });
        this._connectPromise = connectPromise;

        return connectPromise;
    }

    public async send(code: string): Promise<EvaluateResult> {
        const run = this._sendQueue.then(
            () => this._sendNow(code),
            () => this._sendNow(code),
        );
        this._sendQueue = run.then(
            () => undefined,
            () => undefined,
        );

        return run;
    }

    public async sendRaw(code: string): Promise<string> {
        const run = this._sendQueue.then(
            () => this._sendRawNow(code),
            () => this._sendRawNow(code),
        );
        this._sendQueue = run.then(
            () => undefined,
            () => undefined,
        );

        return run;
    }

    public async close(): Promise<void> {
        const socket = this._socket;
        this._socket = null;
        this._connectPromise = null;
        this._rejectPending(new Error("Testplane REPL connection closed"));

        if (!socket || socket.destroyed) {
            return;
        }

        await new Promise<void>(resolve => {
            const timeout = setTimeout(() => {
                socket.destroy();
                resolve();
            }, 1_000);

            socket.once("close", () => {
                clearTimeout(timeout);
                resolve();
            });
            socket.end();
            socket.destroy();
        });
    }

    private async _sendNow(code: string): Promise<EvaluateResult> {
        await this.connect();

        const socket = this._socket;
        if (!socket || socket.destroyed) {
            throw new Error("Testplane REPL connection is not open");
        }

        const id = randomUUID();
        const startMarker = `__TESTPLANE_MCP_RESULT_${id}__`;
        const endMarker = `__TESTPLANE_MCP_END_${id}__`;
        const command = this._createEvaluationCommand(code, startMarker, endMarker);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._pending = null;
                reject(new Error(`Timed out waiting for Testplane REPL evaluation result for: ${code}`));
            }, this._evaluateTimeoutMs);

            this._pending = {
                startMarker,
                endMarker,
                timeout,
                resolve: result => resolve(result as EvaluateResult),
                reject,
                parse: parseEvaluateResult,
            };

            socket.write(command);
            this._tryResolvePending();
        });
    }

    private async _sendRawNow(code: string): Promise<string> {
        await this.connect();

        const socket = this._socket;
        if (!socket || socket.destroyed) {
            throw new Error("Testplane REPL connection is not open");
        }

        await this._sendRawCommand(socket, this._createBrowserFallbackCommand(), "browser fallback setup");

        return this._sendRawCommand(socket, code, code);
    }

    private _sendRawCommand(socket: net.Socket, code: string, timeoutDescription: string): Promise<string> {
        const id = randomUUID();
        const startMarker = `__TESTPLANE_MCP_RAW_RESULT_${id}__`;
        const endMarker = `__TESTPLANE_MCP_RAW_END_${id}__`;
        const markerCommand = this._createRawCompletionMarkerCommand(startMarker, endMarker);
        const command = `${code.endsWith("\n") ? code : `${code}\n`}${markerCommand}`;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._pending = null;
                reject(new Error(`Timed out waiting for Testplane REPL command to finish for: ${timeoutDescription}`));
            }, this._evaluateTimeoutMs);

            this._buffer = "";
            this._pending = {
                startMarker,
                endMarker,
                timeout,
                resolve: result => resolve(result as string),
                reject,
                parse: (_payload, outputBeforePayload) => stripReplPrompts(outputBeforePayload),
            };

            socket.write(command);
            this._tryResolvePending();
        });
    }

    private _createEvaluationCommand(code: string, startMarker: string, endMarker: string): string {
        return `await eval(${serializeFunctionExpression(evaluateReplExpression)}).call(this, ${JSON.stringify(code)}, ${JSON.stringify(startMarker)}, ${JSON.stringify(endMarker)})\n`;
    }

    private _createBrowserFallbackCommand(): string {
        return `void eval(${serializeFunctionExpression(installBrowserFallback)}).call(this)\n`;
    }

    private _createRawCompletionMarkerCommand(startMarker: string, endMarker: string): string {
        return `({ [Symbol.for("nodejs.util.inspect.custom")]: () => ${JSON.stringify(startMarker + endMarker)} })\n`;
    }

    private _onData(data: string): void {
        this._buffer = stripVTControlCharacters(this._buffer + data);
        this._tryResolvePending();
    }

    private _tryResolvePending(): void {
        const pending = this._pending;
        if (!pending) {
            return;
        }

        const startIndex = this._buffer.indexOf(pending.startMarker);
        if (startIndex === -1) {
            return;
        }

        const payloadStart = startIndex + pending.startMarker.length;
        const endIndex = this._buffer.indexOf(pending.endMarker, payloadStart);
        if (endIndex === -1) {
            return;
        }

        const outputBeforePayload = this._buffer.slice(0, startIndex);
        const payload = this._buffer.slice(payloadStart, endIndex).trim();
        this._buffer = this._buffer.slice(endIndex + pending.endMarker.length);
        this._pending = null;
        clearTimeout(pending.timeout);

        try {
            pending.resolve(pending.parse(payload, outputBeforePayload));
        } catch (error) {
            pending.reject(error instanceof Error ? error : new Error(String(error)));
        }
    }

    private _rejectPending(error: Error): void {
        const pending = this._pending;
        if (!pending) {
            return;
        }

        this._pending = null;
        clearTimeout(pending.timeout);
        pending.reject(error);
    }
}

function stripReplPrompts(output: string): string {
    const lines = stripVTControlCharacters(output)
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map(line => line.replace(/^(?:> |\.\.\. )+/, ""));

    while (lines.length > 0 && lines[0].trim() === "") {
        lines.shift();
    }

    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
    }

    return lines.join("\n");
}
