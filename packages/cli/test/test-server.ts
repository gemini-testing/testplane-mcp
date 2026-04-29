import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { launchServer } from "./simple-http-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PlaygroundServer {
    private server: http.Server | null = null;
    private readonly port: number;
    private readonly playgroundPath: string;

    constructor(port?: number) {
        this.port = port ?? Math.floor(Math.random() * (65535 - 3000) + 3000);
        this.playgroundPath = path.join(__dirname, "playground");
    }

    async start(): Promise<string> {
        this.server = await launchServer(this.port, this.playgroundPath);
        return `http://localhost:${this.port}`;
    }

    async stop(): Promise<void> {
        return new Promise(resolve => {
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}
