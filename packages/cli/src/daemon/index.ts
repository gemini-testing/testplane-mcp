import fs from "fs";
import net from "net";

import makeDebug from "debug";
import { JsonSocket } from "../ipc/json-socket.js";
import { findProjectRoot, socketPathFor } from "../ipc/socket-path.js";
import type { Request, Response } from "../ipc/protocol.js";
import { IdleWatchdog } from "./idle-watchdog.js";
import { SessionRegistry } from "./session-registry.js";
import { formatError } from "../utils/error.js";
import { RequestHandler } from "./request-handler.js";

const debug = makeDebug("testplane-cli:daemon");

const IDLE_TTL_MS = Number(process.env.TESTPLANE_CLI_DAEMON_IDLE_MS ?? 30000);
const LOG_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_HEADLESS = !/^(0|false|no)$/i.test(process.env.TESTPLANE_CLI_HEADLESS ?? "");

function errorCode(error: unknown): string | undefined {
    return typeof error === "object" && error !== null && "code" in error
        ? String((error as NodeJS.ErrnoException).code)
        : undefined;
}

function prepareRuntimeFiles(dir: string, logPath: string): void {
    fs.mkdirSync(dir, { recursive: true });

    try {
        const stats = fs.statSync(logPath);
        if (stats.size > LOG_MAX_BYTES) {
            fs.truncateSync(logPath, 0);
        }
    } catch {
        // The log file does not exist yet.
    }
}

export async function startDaemon(): Promise<void> {
    const sessions = new SessionRegistry({ headless: DEFAULT_HEADLESS });
    const requestDispatcher = new RequestHandler();
    const { dir, socket: socketPath, log: logPath } = socketPathFor(findProjectRoot());
    prepareRuntimeFiles(dir, logPath);
    let boundSocket: { dev: number; ino: number } | null = null;

    const watchdog = new IdleWatchdog({
        idleTtlMs: IDLE_TTL_MS,
        onIdleExpired: async () => {
            await sessions.clearStale();

            if (!watchdog.isIdle) {
                return;
            }

            if (sessions.hasLive()) {
                debug("Idle check: skipping shutdown, live sessions remain");

                return;
            }

            debug("Idle timer triggering shutdown");
            shutdown("idle-timeout");
        },
    });

    let isShuttingDown = false;
    const shutdown = async (reason: string): Promise<void> => {
        if (isShuttingDown) {
            return;
        }

        isShuttingDown = true;
        watchdog.stop();
        debug("Shutdown requested: reason=%s", reason);

        setTimeout(() => {
            debug("Forced shutdown timeout reached, exiting");
            process.exit(0);
        }, 5000).unref();

        try {
            await new Promise<void>((resolve, reject) => {
                server.close(err => {
                    return err ? reject(err) : resolve();
                });
            });
            debug("Server closed");
        } catch (error) {
            debug("Server close error: %s", formatError(error));
        }

        try {
            await Promise.allSettled([...requestDispatcher.getRequestsInProgress()]);
            debug("Pending requests drained");
        } catch (error) {
            debug("Pending request drain error: %s", formatError(error));
        }

        try {
            await sessions.cleanupAll();
            debug("Session cleanup complete");
        } catch (error) {
            debug("Session cleanup error: %s", formatError(error));
        }

        removeBoundSocket();

        debug("Shutdown complete: reason=%s", reason);
        process.exit(0);
    };

    const server = net.createServer(socket => {
        watchdog.notifyConnectionAccepted();

        const client = new JsonSocket<Request, Response>(socket);

        client.on("message", req => {
            debug("> Request: id=%d tool=%s session=%s", req.id, req.tool, req.sessionName);

            requestDispatcher
                .handleRequest(req, sessions)
                .then(response => {
                    if (response.kind === "error") {
                        debug("< Response: id=%d status=error code=%s", response.id, response.code);
                    } else {
                        debug("< Response: id=%d status=ok", response.id);
                    }

                    client.send(response);
                })
                .catch(error => {
                    const message = formatError(error);
                    debug("Dispatch error: id=%d message=%s", req.id, message);
                    client.send({ id: req.id, kind: "error", code: "TOOL_ERROR", message });
                });
        });

        client.on("error", error => {
            debug("Connection error: %s", error.message);
        });

        client.on("close", () => {
            watchdog.notifyConnectionClosed();
        });
    });

    function removeBoundSocket(): void {
        if (!boundSocket) {
            debug("Skipping socket removal: daemon did not record a bound socket");

            return;
        }

        try {
            const stats = fs.statSync(socketPath);
            if (stats.dev !== boundSocket.dev || stats.ino !== boundSocket.ino) {
                debug("Skipping socket removal: path is now owned by another daemon");

                return;
            }

            fs.rmSync(socketPath, { force: true });
        } catch (error) {
            if (errorCode(error) !== "ENOENT") {
                debug("Socket removal error: %s", formatError(error));
            }
        }
    }

    server.on("error", error => {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "EADDRINUSE") {
            debug("Server startup aborted: socket already in use");
            process.exit(0);
        }

        console.error("Daemon server error:", error);
        process.exit(1);
    });

    server.listen(socketPath, () => {
        try {
            const stats = fs.statSync(socketPath);
            boundSocket = { dev: stats.dev, ino: stats.ino };
        } catch (error) {
            debug("Socket stat error: %s", formatError(error));
        }

        debug("Daemon started: pid=%d socketPath=%s", process.pid, socketPath);
        watchdog.start();
    });

    process.on("SIGINT", () => {
        shutdown("SIGINT");
    });

    process.on("SIGTERM", () => {
        shutdown("SIGTERM");
    });
}
