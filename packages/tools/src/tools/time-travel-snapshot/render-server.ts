import { randomUUID } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { NumberedRrwebEvent } from "./rrweb-snapshots.js";

export interface TimeTravelRenderServer {
    url: string;
    close: () => Promise<void>;
}

const require = createRequire(import.meta.url);

function getRrwebReplayDistPath(fileName: string): string {
    const replayEntry = require.resolve("@rrweb/replay");

    return path.join(path.dirname(replayEntry), fileName);
}

function sendText(response: ServerResponse, statusCode: number, contentType: string, body: string): void {
    response.writeHead(statusCode, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
    });
    response.end(body);
}

async function sendFile(response: ServerResponse, contentType: string, filePath: string): Promise<void> {
    response.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
    });
    response.end(await readFile(filePath));
}

function createRendererHtml(offsetMs: number, token: string): string {
    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Time Travel Snapshot</title>
    <link rel="stylesheet" href="/rrweb/style.css?token=${token}">
    <style>
        html, body {
            margin: 0;
            padding: 0;
            background: white;
        }

        #player {
            width: max-content;
            height: max-content;
        }

        .replayer-wrapper {
            transform: none !important;
            transform-origin: top left !important;
        }
    </style>
</head>
<body>
    <div id="player"></div>
    <script type="module">
        import {Replayer} from "/rrweb/replay.js?token=${token}";

        const offsetMs = ${JSON.stringify(offsetMs)};

        function waitForNextFrames() {
            return new Promise(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });
        }

        async function render() {
            const response = await fetch("/events?token=${token}");
            if (!response.ok) {
                throw new Error("Failed to load rrweb events: " + response.status + " " + response.statusText);
            }

            const events = await response.json();
            const root = document.getElementById("player");
            const replayer = new Replayer(events, {
                root,
                showWarning: false,
                mouseTail: false,
                speed: 1
            });
            window.__timeTravelReplayer = replayer;

            let fullSnapshotRebuilt = false;
            const fullSnapshotPromise = new Promise(resolve => {
                replayer.on("fullsnapshot-rebuilded", () => {
                    fullSnapshotRebuilt = true;
                    resolve();
                });
                setTimeout(resolve, 2000);
            });

            replayer.pause(offsetMs);
            await fullSnapshotPromise;
            await waitForNextFrames();

            const iframe = document.querySelector("iframe");
            if (!iframe) {
                throw new Error("rrweb did not create a replay iframe");
            }

            iframe.setAttribute("data-time-travel-target", "true");
            document.documentElement.dataset.timeTravelReady = "true";
            document.documentElement.dataset.timeTravelFullSnapshotRebuilt = String(fullSnapshotRebuilt);
        }

        render().catch(error => {
            const message = error instanceof Error ? (error.stack || error.message) : String(error);
            window.__timeTravelError = message;
            document.documentElement.dataset.timeTravelError = message;
            document.body.textContent = message;
        });
    </script>
</body>
</html>`;
}

function assertToken(url: URL, token: string): void {
    if (url.searchParams.get("token") !== token) {
        throw new Error("Invalid render server token.");
    }
}

async function handleRequest(
    requestUrl: string | undefined,
    token: string,
    eventsJson: string,
    offsetMs: number,
    response: ServerResponse,
): Promise<void> {
    const url = new URL(requestUrl ?? "/", "http://127.0.0.1");

    assertToken(url, token);

    if (url.pathname === "/") {
        sendText(response, 200, "text/html; charset=utf-8", createRendererHtml(offsetMs, token));
        return;
    }

    if (url.pathname === "/events") {
        sendText(response, 200, "application/json; charset=utf-8", eventsJson);
        return;
    }

    if (url.pathname === "/rrweb/replay.js") {
        await sendFile(response, "text/javascript; charset=utf-8", getRrwebReplayDistPath("replay.js"));
        return;
    }

    if (url.pathname === "/rrweb/style.css") {
        await sendFile(response, "text/css; charset=utf-8", getRrwebReplayDistPath("style.css"));
        return;
    }

    sendText(response, 404, "text/plain; charset=utf-8", "Not found");
}

function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close(error => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
        server.closeAllConnections?.();
    });
}

export async function startTimeTravelRenderServer(
    events: readonly NumberedRrwebEvent[],
    offsetMs: number,
): Promise<TimeTravelRenderServer> {
    const token = randomUUID();
    const eventsJson = JSON.stringify(events);
    const server = createServer((request, response) => {
        handleRequest(request.url, token, eventsJson, offsetMs, response).catch(error => {
            sendText(
                response,
                500,
                "text/plain; charset=utf-8",
                error instanceof Error ? error.message : String(error),
            );
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });

    const address = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${address.port}/?token=${token}`,
        close: () => closeServer(server),
    };
}
