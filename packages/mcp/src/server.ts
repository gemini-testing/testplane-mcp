import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { WdioBrowser } from "testplane";

import { tools, ToolKind, launchBrowserWithOptions, type BrowserOptions } from "@testplane/tools";

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

export async function startServer(serverOptions: ServerOptions = {}): Promise<McpServer> {
    let browser: WdioBrowser | null = null;
    let options: BrowserOptions = { headless: serverOptions.headless ?? false };

    const server = new McpServer({
        name: packageJson.name,
        version: packageJson.version,
    });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    for (const tool of tools) {
        server.tool(tool.name, tool.description, tool.schema, async (args: any) => {
            if (tool.kind === ToolKind.Action) {
                if (!browser) {
                    browser = await launchBrowserWithOptions(options);
                }

                return tool.cb(args, browser);
            }

            if (tool.kind === ToolKind.SessionOpen) {
                const result = await tool.cb(args, options);

                if (result.browser) {
                    if (browser) {
                        try {
                            await browser.deleteSession();
                        } catch (error) {
                            console.error("Error closing existing browser before opening a new session:", error);
                        }
                        browser = null;
                    }

                    browser = result.browser;
                    options = result.options;
                }

                return result.response;
            }

            const response = await tool.cb(args, browser);
            browser = null;
            return response;
        });
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

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
                    if (browser) {
                        try {
                            await browser.deleteSession();
                            console.error("Browser session closed");
                        } catch (error) {
                            console.error("Error closing browser session:", error);
                        } finally {
                            browser = null;
                        }
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
