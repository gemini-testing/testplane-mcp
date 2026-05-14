import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { ReplConnection, type EvaluateResult } from "../../src/browser/repl-connection.js";

interface FakeReplServer {
    port: number;
    writes: string[];
    close(): Promise<void>;
}

function marker(command: string, name: "RESULT" | "END" | "RAW_RESULT" | "RAW_END"): string {
    const match = command.match(new RegExp(`__TESTPLANE_MCP_${name}_[^"]+?__`));
    if (!match) {
        throw new Error(`No ${name} marker in command:\n${command}`);
    }

    return match[0];
}

async function createFakeReplServer(handler: (command: string) => EvaluateResult): Promise<FakeReplServer> {
    const writes: string[] = [];
    const sockets = new Set<net.Socket>();
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.on("data", data => {
            const command = data.toString();
            writes.push(command);

            const startMarker = marker(command, "RESULT");
            const endMarker = marker(command, "END");
            const response = `${startMarker}${JSON.stringify(handler(command))}${endMarker}`;

            socket.write("> ");
            socket.write(response.slice(0, Math.floor(response.length / 2)));
            socket.write(response.slice(Math.floor(response.length / 2)) + "\n> ");
        });
        socket.on("close", () => sockets.delete(socket));
    });

    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Expected TCP server address");
    }

    return {
        port: address.port,
        writes,
        close: () =>
            new Promise<void>(resolve => {
                for (const socket of sockets) {
                    socket.destroy();
                }
                server.close(() => resolve());
            }),
    };
}

async function createFakeRawReplServer(output: string): Promise<FakeReplServer> {
    const writes: string[] = [];
    const sockets = new Set<net.Socket>();
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.on("data", data => {
            const command = data.toString();
            writes.push(command);

            const startMarker = marker(command, "RAW_RESULT");
            const endMarker = marker(command, "RAW_END");

            socket.write("> ");
            socket.write(output);
            socket.write(`\n> ${startMarker}${endMarker}\n> `);
        });
        socket.on("close", () => sockets.delete(socket));
    });

    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Expected TCP server address");
    }

    return {
        port: address.port,
        writes,
        close: () =>
            new Promise<void>(resolve => {
                for (const socket of sockets) {
                    socket.destroy();
                }
                server.close(() => resolve());
            }),
    };
}

describe("browser/ReplConnection", () => {
    let server: FakeReplServer | null = null;
    let connection: ReplConnection | null = null;

    afterEach(async () => {
        if (connection) {
            await connection.close();
            connection = null;
        }

        if (server) {
            await server.close();
            server = null;
        }
    });

    it("parses a JSON result block surrounded by REPL prompts", async () => {
        server = await createFakeReplServer(() => ({ ok: true, value: { url: "https://example.test" } }));
        connection = new ReplConnection({ port: server.port, evaluateTimeoutMs: 1_000 });

        const result = await connection.send("await browser.getUrl()");

        expect(result).toEqual({ ok: true, value: { url: "https://example.test" } });
        expect(server.writes).toHaveLength(1);
        expect(server.writes[0]).toContain("await browser.getUrl()");
        expect(server.writes[0]).toContain("function evaluateReplExpression");
        expect(server.writes[0]).toContain("this.browser");
        expect(server.writes[0].slice(0, -1)).not.toContain("\n");
    });

    it("returns evaluation errors without throwing transport errors", async () => {
        server = await createFakeReplServer(() => ({ ok: false, error: { message: "page crashed" } }));
        connection = new ReplConnection({ port: server.port, evaluateTimeoutMs: 1_000 });

        await expect(connection.send("await browser.getUrl()")).resolves.toEqual({
            ok: false,
            error: { message: "page crashed" },
        });
    });

    it("passes raw code through and strips REPL prompts from output", async () => {
        server = await createFakeRawReplServer("... pending\n42");
        connection = new ReplConnection({ port: server.port, evaluateTimeoutMs: 1_000 });

        await expect(connection.sendRaw("const value = await browser.getUrl();\nvalue")).resolves.toBe("pending\n42");
        expect(server.writes).toHaveLength(2);
        const [fallbackCommand, markerCommand, tail] = server.writes[0].split("\n");
        expect(fallbackCommand).toContain("function installBrowserFallback");
        expect(fallbackCommand).toContain("globalThis.browser");
        expect(markerCommand).toContain("__TESTPLANE_MCP_RAW_RESULT_");
        expect(tail).toBe("");
        expect(server.writes[1]).toContain("const value = await browser.getUrl();\nvalue\n");
        expect(server.writes[1]).toContain("__TESTPLANE_MCP_RAW_RESULT_");
        expect(server.writes[1]).not.toContain("await (async ()");
    });
});
