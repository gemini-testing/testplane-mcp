import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_SERVER_PATH = path.join(__dirname, "../build/cli.js");

export async function startClient(): Promise<Client> {
    const client = new Client({ name: "testplane-mcp-e2e", version: "1.0.0" });

    const transport = new StdioClientTransport({
        command: "node",
        args: [MCP_SERVER_PATH, "--headless"],
        cwd: path.join(__dirname, "../.."),
        env: process.env as Record<string, string>,
    });

    await client.connect(transport);
    await client.ping();

    return client;
}

export const E2E_TEST_TIMEOUT = 30000;
