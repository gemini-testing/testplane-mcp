import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { tools } from "./tools/index.js";
import { BrowserContext } from "./browser-context.js";
import { Context } from "./types.js";
import { contextProvider } from "./context-provider.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

interface PackageJson {
    name: string;
    version: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson: PackageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

export interface ServerOptions {
    headless?: boolean;
}

export async function startServer(options: ServerOptions = {}): Promise<McpServer> {
    const browserContext = new BrowserContext(options);

    const context: Context = {
        browser: browserContext,
    };

    contextProvider.setContext(context);

    const server = new McpServer({
        name: packageJson.name,
        version: packageJson.version,
    });

    for (const tool of tools) {
        server.tool(tool.name, tool.description, tool.schema, tool.cb);
    }

    console.error("Starting Testplane MCP server...");
    console.error("Name:", packageJson.name, "Version:", packageJson.version);

    const transport = new StdioServerTransport();

    try {
        await server.connect(transport);
        console.error("Testplane MCP server connected");

        let isShuttingDown = false;
        const cleanup = () => {
            if (isShuttingDown) {
                return;
            }
            isShuttingDown = true;

            console.error("Shutting down server, cleaning up resources...");

            const cleanupTimeout = setTimeout(() => {
                console.error("Cleanup timeout reached, forcing exit");
                process.exit(1);
            }, 5000);

            Promise.resolve()
                .then(async () => {
                    if (await context.browser.isActive()) {
                        await context.browser.close();
                    }
                })
                .then(() => {
                    console.error("Cleanup completed");
                    clearTimeout(cleanupTimeout);
                    process.exit(0);
                })
                .catch(error => {
                    console.error("Error during cleanup:", error);
                    clearTimeout(cleanupTimeout);
                    process.exit(1);
                });
        };

        process.on("SIGINT", () => {
            console.error("Received SIGINT signal, shutting down...");
            cleanup();
        });

        process.on("SIGTERM", () => {
            console.error("Received SIGTERM signal, shutting down...");
            cleanup();
        });

        process.on("exit", code => {
            console.error(`Process exiting with code ${code}`);
        });

        return server;
    } catch (error) {
        console.error("Error connecting MCP server:", error);
        throw error;
    }
}
