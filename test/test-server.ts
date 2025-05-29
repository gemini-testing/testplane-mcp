import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TestServer {
    start(): Promise<string>;
    stop(): Promise<void>;
}

export class PlaygroundServer implements TestServer {
    private serverProcess: ChildProcess | null = null;
    private readonly port: number;
    private readonly playgroundPath: string;

    constructor(port: number = 8090) {
        this.port = port;
        this.playgroundPath = path.join(__dirname, "playground");
    }

    async start(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.serverProcess = spawn(
                "npx",
                ["http-server", this.playgroundPath, "-p", this.port.toString(), "--silent"],
                {
                    stdio: ["ignore", "pipe", "pipe"],
                    cwd: path.join(__dirname, ".."),
                },
            );

            this.serverProcess.on("error", error => {
                reject(new Error(`Failed to start server: ${error.message}`));
            });

            this.serverProcess.on("exit", code => {
                if (code !== 0 && code !== null) {
                    reject(new Error(`Server exited with code ${code}`));
                }
            });

            setTimeout(() => {
                if (this.serverProcess && !this.serverProcess.killed) {
                    resolve(`http://localhost:${this.port}`);
                } else {
                    reject(new Error(`Server startup failed`));
                }
            }, 1000);
        });
    }

    async stop(): Promise<void> {
        return new Promise(resolve => {
            if (this.serverProcess && !this.serverProcess.killed) {
                this.serverProcess.kill();
                this.serverProcess.on("exit", () => {
                    this.serverProcess = null;
                    resolve();
                });

                setTimeout(() => {
                    if (this.serverProcess && !this.serverProcess.killed) {
                        this.serverProcess.kill("SIGKILL");
                        this.serverProcess = null;
                        resolve();
                    }
                }, 2000);
            } else {
                resolve();
            }
        });
    }
}

let globalTestServer: PlaygroundServer | null = null;

export const getTestServerUrl = async (): Promise<string> => {
    if (!globalTestServer) {
        globalTestServer = new PlaygroundServer();
        return globalTestServer.start();
    }
    return `http://localhost:8090`;
};

export const stopTestServer = async (): Promise<void> => {
    if (globalTestServer) {
        await globalTestServer.stop();
        globalTestServer = null;
    }
};
