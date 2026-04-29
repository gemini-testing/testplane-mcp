import { EventEmitter } from "events";
import type { Socket } from "net";
import { describe, it, expect, beforeEach } from "vitest";

import { JsonSocket } from "../../src/ipc/json-socket.js";
import type { Request, Response } from "../../src/ipc/protocol.js";

class MockSocket extends EventEmitter {
    writes: string[] = [];
    ended = false;
    destroyed = false;

    write(data: Buffer | string): boolean {
        this.writes.push(typeof data === "string" ? data : data.toString("utf8"));
        return true;
    }

    end(): void {
        this.ended = true;
        this.emit("end");
    }

    destroy(): void {
        this.destroyed = true;
        this.emit("close");
    }
}

function mockSocket(): { mock: MockSocket; socket: Socket } {
    const mock = new MockSocket();
    return { mock, socket: mock as unknown as Socket };
}

describe("ipc/JsonSocket", () => {
    let mock: MockSocket;
    let conn: JsonSocket<Request, Response>;

    beforeEach(() => {
        const { mock: m, socket } = mockSocket();
        mock = m;
        conn = new JsonSocket<Request, Response>(socket);
    });

    it("emits a message on a complete line", () => {
        const messages: Request[] = [];
        conn.on("message", msg => messages.push(msg));

        mock.emit(
            "data",
            Buffer.from('{"id":1,"kind":"call","tool":"navigate","sessionName":"default","args":{"url":"x"}}\n'),
        );

        expect(messages).toHaveLength(1);
        expect(messages[0]).toEqual({
            id: 1,
            kind: "call",
            tool: "navigate",
            sessionName: "default",
            args: { url: "x" },
        });
    });

    it("emits multiple messages from one chunk", () => {
        const messages: Request[] = [];
        conn.on("message", msg => messages.push(msg));

        mock.emit(
            "data",
            '{"id":1,"kind":"call","tool":"a","sessionName":"default","args":{}}\n' +
                '{"id":2,"kind":"call","tool":"b","sessionName":"default","args":{}}\n',
        );

        expect(messages).toHaveLength(2);
        expect(messages[0].tool).toBe("a");
        expect(messages[1].tool).toBe("b");
    });

    it("buffers a message split across chunks", () => {
        const messages: Request[] = [];
        conn.on("message", msg => messages.push(msg));

        mock.emit("data", '{"id":1,"kind":"call","tool":"nav');
        expect(messages).toHaveLength(0);
        mock.emit("data", 'igate","sessionName":"default","args":{}}\n');
        expect(messages).toHaveLength(1);
        expect(messages[0].tool).toBe("navigate");
    });

    it("emits an error for malformed JSON but keeps processing subsequent lines", () => {
        const messages: Request[] = [];
        const errors: Error[] = [];
        conn.on("message", msg => messages.push(msg));
        conn.on("error", err => errors.push(err));

        mock.emit("data", '{not valid json}\n{"id":1,"kind":"call","tool":"a","sessionName":"default","args":{}}\n');

        expect(errors).toHaveLength(1);
        expect(messages).toHaveLength(1);
        expect(messages[0].tool).toBe("a");
    });

    it("ignores empty lines", () => {
        const messages: Request[] = [];
        conn.on("message", msg => messages.push(msg));

        mock.emit("data", "\n\n\n");
        expect(messages).toHaveLength(0);
    });

    it("send() writes one JSON line to the underlying socket", () => {
        const ok = conn.send({ id: 7, kind: "result", result: { content: [{ type: "text", text: "done" }] } });
        expect(ok).toBe(true);
        expect(mock.writes).toEqual([
            '{"id":7,"kind":"result","result":{"content":[{"type":"text","text":"done"}]}}\n',
        ]);
    });

    it("send() returns false after close", () => {
        mock.emit("close");
        expect(conn.isClosed).toBe(true);
        const ok = conn.send({ id: 1, kind: "result" });
        expect(ok).toBe(false);
        expect(mock.writes).toEqual([]);
    });

    it("emits close when the underlying socket closes", () => {
        let closed = false;
        conn.on("close", () => {
            closed = true;
        });
        mock.emit("close");
        expect(closed).toBe(true);
    });

    it("emits end when the underlying socket ends", () => {
        let ended = false;
        conn.on("end", () => {
            ended = true;
        });
        mock.emit("end");
        expect(ended).toBe(true);
    });

    it("propagates socket errors", () => {
        const errors: Error[] = [];
        conn.on("error", err => errors.push(err));
        mock.emit("error", new Error("boom"));
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe("boom");
    });

    it("roundtrips send -> remote receive via a connected pair", () => {
        // Simulate a pair of mock sockets wired together: a write on one becomes a
        // data event on the other. Validates send + on("message") end-to-end.
        const a = new MockSocket();
        const b = new MockSocket();
        a.write = (data: Buffer | string): boolean => {
            b.emit("data", typeof data === "string" ? data : data.toString("utf8"));
            return true;
        };
        b.write = (data: Buffer | string): boolean => {
            a.emit("data", typeof data === "string" ? data : data.toString("utf8"));
            return true;
        };

        const left = new JsonSocket<Response, Request>(a as unknown as Socket);
        const right = new JsonSocket<Request, Response>(b as unknown as Socket);

        const leftReceived: Response[] = [];
        const rightReceived: Request[] = [];
        left.on("message", m => leftReceived.push(m));
        right.on("message", m => rightReceived.push(m));

        left.send({ id: 1, kind: "call", tool: "click", sessionName: "default", args: { selector: "#x" } });
        right.send({ id: 1, kind: "result", result: { content: [{ type: "text", text: "ok" }] } });

        expect(rightReceived).toEqual([
            { id: 1, kind: "call", tool: "click", sessionName: "default", args: { selector: "#x" } },
        ]);
        expect(leftReceived).toEqual([{ id: 1, kind: "result", result: { content: [{ type: "text", text: "ok" }] } }]);
    });
});
