#!/usr/bin/env node

import { program } from "commander";

import { registerAllTools } from "./tools.js";

program
    .name("testplane-cli")
    .description("Testplane CLI: interact with browser right from your terminal")
    .option("--session-name <name>", "Session name, useful for running multiple browsers at once.", "default");

registerAllTools(program, () => (program.opts().sessionName as string) ?? "default");

program.parseAsync(process.argv).catch(err => {
    process.stderr.write(`cli error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
});
