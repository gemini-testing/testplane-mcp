#!/usr/bin/env node

import { program } from "commander";
import { startServer } from "./server.js";

program.name("Testplane MCP Server").action(async () => {
    await startServer().catch((error: Error) => {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    });
});

program.parse(process.argv);
