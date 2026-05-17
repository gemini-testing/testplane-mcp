import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { attachRepl } from "../../src/tools/attach-repl.js";

interface FakeReplServer {
    port: number;
    close(): Promise<void>;
}

function marker(command: string, name: "RESULT" | "END"): string {
    const match = command.match(new RegExp(`__TESTPLANE_MCP_${name}_[^"]+?__`));
    if (!match) {
        throw new Error(`No ${name} marker in command:\n${command}`);
    }

    return match[0];
}

async function createFakeReplServer(): Promise<FakeReplServer> {
    const sockets = new Set<net.Socket>();
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.on("data", data => {
            const command = data.toString();
            const startMarker = marker(command, "RESULT");
            const endMarker = marker(command, "END");
            socket.write(`> ${startMarker}${JSON.stringify({ ok: true, value: "about:blank" })}${endMarker}\n> `);
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
        close: () =>
            new Promise<void>(resolve => {
                for (const socket of sockets) {
                    socket.destroy();
                }
                server.close(() => resolve());
            }),
    };
}

describe("tools/attachRepl", () => {
    let server: FakeReplServer | null = null;

    afterEach(async () => {
        if (server) {
            await server.close();
            server = null;
        }
    });

    it("attaches to a Testplane REPL endpoint", async () => {
        server = await createFakeReplServer();

        const result = await attachRepl.cb({ port: server.port, host: "127.0.0.1" }, {});

        expect(result.browser).not.toBeNull();
        expect(result.transport).toBe("attach-repl");
        expect(result.response.isError).toBeFalsy();
        expect(result.response.content[0].type).toBe("text");
        expect(result.response.content[0].text).toBe(`Attached to Testplane REPL at 127.0.0.1:${server.port}`);

        await result.browser?.deleteSession();
    });
});
