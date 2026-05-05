import { Command } from "commander";
import type { ZodRawShape, ZodTypeAny } from "zod";

import { tools, Tool } from "@testplane/tools";

import makeDebug from "debug";
import { sendRequest } from "./client.js";
import { renderAndExit } from "./render.js";
import { describeZodField, registerFlag, registerPositional } from "./zod-to-commander.js";

const debug = makeDebug("testplane-cli:tools");

interface ToolToRegister {
    name: Tool<ZodRawShape>["name"];
    description: Tool<ZodRawShape>["description"];
    schema: Tool<ZodRawShape>["schema"];
    cli?: {
        section?: string;
        positional?: string[];
        usage?: string;
        examples?: string[];
    };
}

let nextRequestId = 1;

function registerTool(program: Command, tool: ToolToRegister, getSessionName: () => string): void {
    const cmd = program.command(tool.name).description(tool.description);

    if (tool.cli?.section) {
        cmd.helpGroup(tool.cli.section);
    }
    if (tool.cli?.usage) {
        cmd.usage(tool.cli.usage);
    }
    if (tool.cli?.examples?.length) {
        cmd.addHelpText("after", `\nExamples:\n${tool.cli.examples.map(example => `  ${example}`).join("\n")}`);
    }

    const positionalNames: string[] = (tool.cli?.positional ?? []) as string[];
    for (const fieldName of positionalNames) {
        const fieldSchema = tool.schema[fieldName] as ZodTypeAny | undefined;
        if (!fieldSchema) {
            continue;
        }

        registerPositional(cmd, fieldName, describeZodField(fieldSchema));
    }

    for (const [fieldName, fieldSchema] of Object.entries(tool.schema)) {
        if (positionalNames.includes(fieldName)) {
            continue;
        }

        registerFlag(cmd, fieldName, describeZodField(fieldSchema as ZodTypeAny));
    }

    cmd.action(async (...actionArgs: unknown[]) => {
        try {
            const positionalValues = actionArgs.slice(0, positionalNames.length);
            const opts = (actionArgs[positionalNames.length] ?? {}) as Record<string, unknown>;

            const args: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(opts)) {
                if (value === undefined) {
                    continue;
                }
                args[key] = value;
            }
            for (let i = 0; i < positionalNames.length; i += 1) {
                const value = positionalValues[i];
                if (value === undefined) {
                    continue;
                }
                args[positionalNames[i]] = value;
            }

            debug("Invoking: tool=%s args=%o", tool.name, args);
            const res = await sendRequest({
                id: nextRequestId++,
                kind: "call",
                tool: tool.name,
                sessionName: getSessionName(),
                args,
            });

            renderAndExit(res);
        } catch (err) {
            process.stderr.write(`${tool.name}: ${err instanceof Error ? err.message : String(err)}\n`);
            process.exit(2);
        }
    });
}

export function registerAllTools(program: Command, getSessionName: () => string): void {
    for (const tool of tools) {
        registerTool(program, tool, getSessionName);
    }
}
