import { launchServer } from "./simple-http-server.js";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TestServer {
    start(): Promise<string>;
    stop(): Promise<void>;
}

export class PlaygroundServer implements TestServer {
    private server: http.Server | null = null;
    private readonly port: number;
    private readonly playgroundPath: string;

    constructor(port?: number) {
        this.port = port ?? Math.floor(Math.random() * (65535 - 3000) + 3000);
        this.playgroundPath = path.join(__dirname, "playground");
    }

    async start(): Promise<string> {
        this.server = await launchServer(this.port, this.playgroundPath);
        const url = `http://localhost:${this.port}`;

        return url;
    }

    async stop(): Promise<void> {
        console.log("Stopping HTTP server...");
        return new Promise(resolve => {
            if (this.server) {
                this.server.close(() => {
                    console.log("HTTP server stopped");
                    this.server = null;
                    resolve();
                });
            } else {
                console.log("No server to stop");
                resolve();
            }
        });
    }
}
