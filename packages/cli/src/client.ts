import { createConnection, type Socket } from "net";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import makeDebug from "debug";

import { JsonSocket } from "./ipc/json-socket.js";
import { findProjectRoot, socketPathFor, type SocketPaths } from "./ipc/socket-path.js";
import type { Request, Response } from "./ipc/protocol.js";

const debug = makeDebug("testplane-cli:client");

const CONNECT_TIMEOUT_MS = 2000;
const SPAWN_WAIT_MS = 10000;
const SPAWN_POLL_INTERVAL_MS = 50;
const SPAWN_LOCK_WAIT_MS = SPAWN_WAIT_MS * 3;
const SPAWN_LOCK_STALE_MS = SPAWN_WAIT_MS * 2;

interface SpawnLock {
    path: string;
    token: string;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function errorCode(error: unknown): string | undefined {
    return typeof error === "object" && error !== null && "code" in error
        ? String((error as NodeJS.ErrnoException).code)
        : undefined;
}

function spawnLockPath(socketPath: string): string {
    return `${socketPath}.spawn.lock`;
}

function tryRemoveStaleSpawnLock(lockPath: string): void {
    try {
        const stats = fs.statSync(lockPath);
        const ageMs = Date.now() - stats.mtimeMs;
        if (ageMs < SPAWN_LOCK_STALE_MS) {
            return;
        }

        debug("Removing stale daemon spawn lock: path=%s ageMs=%d", lockPath, ageMs);
        fs.rmSync(lockPath, { force: true });
    } catch (err) {
        if (errorCode(err) !== "ENOENT") {
            throw err;
        }
    }
}

async function acquireSpawnLock(lockPath: string, timeoutMs: number): Promise<SpawnLock> {
    const deadline = Date.now() + timeoutMs;
    const token = `${process.pid}:${Date.now()}:${Math.random()}`;

    while (Date.now() < deadline) {
        try {
            const fd = fs.openSync(lockPath, "wx");
            try {
                fs.writeSync(fd, token);
            } catch (err) {
                fs.rmSync(lockPath, { force: true });
                throw err;
            } finally {
                fs.closeSync(fd);
            }

            return { path: lockPath, token };
        } catch (err) {
            if (errorCode(err) !== "EEXIST") {
                throw err;
            }

            tryRemoveStaleSpawnLock(lockPath);
            await sleep(SPAWN_POLL_INTERVAL_MS);
        }
    }

    throw new Error(`daemon spawn lock was not acquired within ${timeoutMs}ms`);
}

function releaseSpawnLock(lock: SpawnLock): void {
    try {
        if (fs.readFileSync(lock.path, "utf8") !== lock.token) {
            return;
        }

        fs.rmSync(lock.path, { force: true });
    } catch (err) {
        if (errorCode(err) !== "ENOENT") {
            debug("Daemon spawn lock release failed: %s", err instanceof Error ? err.message : String(err));
        }
    }
}

function attemptConnect(socketPath: string, timeoutMs: number): Promise<Socket> {
    return new Promise((resolve, reject) => {
        const socket = createConnection(socketPath);
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            socket.destroy();
            reject(new Error("connect timeout"));
        }, timeoutMs);

        socket.once("connect", () => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve(socket);
        });

        socket.once("error", err => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            reject(err);
        });
    });
}

function resolveDaemonPath(): string {
    const here = fileURLToPath(import.meta.url);
    return path.join(path.dirname(here), "daemon.js");
}

function spawnDaemon(logPath: string): void {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const logFd = fs.openSync(logPath, "a");
    const daemonPath = resolveDaemonPath();

    debug("Spawning daemon: path=%s logPath=%s", daemonPath, logPath);
    const child = spawn(process.execPath, [daemonPath], {
        detached: true,
        stdio: ["ignore", logFd, logFd],
    });
    child.unref();

    fs.closeSync(logFd);
}

async function waitUntilConnected(socketPath: string, timeoutMs: number): Promise<Socket> {
    const deadline = Date.now() + timeoutMs;
    let lastErr: unknown = null;
    while (Date.now() < deadline) {
        try {
            return await attemptConnect(socketPath, 500);
        } catch (err) {
            lastErr = err;
            await sleep(SPAWN_POLL_INTERVAL_MS);
        }
    }
    throw new Error(
        `daemon did not become ready within ${timeoutMs}ms (last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)})`,
    );
}

async function connectOrSpawn(paths: SocketPaths): Promise<Socket> {
    try {
        const sock = await attemptConnect(paths.socket, CONNECT_TIMEOUT_MS);
        debug("Connected to existing daemon");

        return sock;
    } catch (err) {
        debug("Initial connect failed (%s), spawning daemon", err instanceof Error ? err.message : String(err));
    }

    fs.mkdirSync(paths.dir, { recursive: true });
    const spawnLock = await acquireSpawnLock(spawnLockPath(paths.socket), SPAWN_LOCK_WAIT_MS);
    try {
        try {
            const sock = await attemptConnect(paths.socket, CONNECT_TIMEOUT_MS);
            debug("Connected to daemon started by another process");

            return sock;
        } catch (err) {
            debug(
                "Connect under spawn lock failed (%s), spawning daemon",
                err instanceof Error ? err.message : String(err),
            );
        }

        fs.rmSync(paths.socket, { force: true });

        spawnDaemon(paths.log);
        const sock = await waitUntilConnected(paths.socket, SPAWN_WAIT_MS);
        debug("Connected after spawn");

        return sock;
    } finally {
        releaseSpawnLock(spawnLock);
    }
}

export async function sendRequest(req: Request): Promise<Response> {
    const resolved: SocketPaths = socketPathFor(findProjectRoot());
    const socket = await connectOrSpawn(resolved);
    const daemon = new JsonSocket<Response, Request>(socket);

    return new Promise<Response>((resolve, reject) => {
        let responded = false;

        daemon.on("message", msg => {
            responded = true;
            debug("< Response: id=%d kind=%s", msg.id, msg.kind);
            daemon.end();
            resolve(msg);
        });

        daemon.on("error", err => {
            if (responded) {
                return;
            }
            reject(err);
        });

        daemon.on("close", () => {
            if (!responded) {
                reject(new Error("daemon closed connection before responding"));
            }
        });

        debug("> Request: id=%d tool=%s session=%s", req.id, req.tool, req.sessionName);

        daemon.send(req);
    });
}
