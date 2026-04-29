import type { Socket } from "net";

type EventMap<In> = {
    message: (msg: In) => void;
    error: (err: Error) => void;
    close: () => void;
    end: () => void;
};

export class JsonSocket<In = unknown, Out = unknown> {
    private readonly _socket: Socket;
    private _buffer = "";
    private _closed = false;
    private readonly _listeners: { [K in keyof EventMap<In>]: Array<EventMap<In>[K]> } = {
        message: [],
        error: [],
        close: [],
        end: [],
    };

    constructor(socket: Socket) {
        this._socket = socket;

        socket.on("data", this._handleData);
        socket.on("close", this._handleClose);
        socket.on("end", this._handleEnd);
        socket.on("error", this._handleError);
    }

    on<E extends keyof EventMap<In>>(event: E, listener: EventMap<In>[E]): this {
        this._listeners[event].push(listener);

        return this;
    }

    send(msg: Out): boolean {
        if (this._closed) {
            return false;
        }

        return this._socket.write(JSON.stringify(msg) + "\n");
    }

    end(): void {
        this._socket.end();
    }

    destroy(): void {
        this._socket.destroy();
    }

    get isClosed(): boolean {
        return this._closed;
    }

    private _handleData = (chunk: Buffer | string): void => {
        this._buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");

        let nl = this._buffer.indexOf("\n");

        while (nl !== -1) {
            const line = this._buffer.slice(0, nl);
            this._buffer = this._buffer.slice(nl + 1);
            nl = this._buffer.indexOf("\n");

            if (line.length === 0) {
                continue;
            }

            try {
                const parsed = JSON.parse(line) as In;
                for (const listener of this._listeners.message) {
                    listener(parsed);
                }
            } catch (err) {
                const e = err instanceof Error ? err : new Error(String(err));
                for (const listener of this._listeners.error) {
                    listener(e);
                }
            }
        }
    };

    private _handleClose = (): void => {
        this._closed = true;
        for (const listener of this._listeners.close) {
            listener();
        }
    };

    private _handleEnd = (): void => {
        for (const listener of this._listeners.end) {
            listener();
        }
    };

    private _handleError = (err: Error): void => {
        for (const listener of this._listeners.error) {
            listener(err);
        }
    };
}
