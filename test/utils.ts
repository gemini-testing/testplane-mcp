import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_SERVER_PATH = path.join(__dirname, "../build/cli.js");

export const startClient = async (): Promise<Client> => {
    const client = new Client({ name: "test-navigate", version: "1.0.0" });

    const args = ["--headless"];

    const transport = new StdioClientTransport({
        command: "node",
        args: [MCP_SERVER_PATH, ...args],
        cwd: path.join(__dirname, "../.."),
        env: process.env as Record<string, string>,
    });

    await client.connect(transport);
    await client.ping();

    return client;
};
