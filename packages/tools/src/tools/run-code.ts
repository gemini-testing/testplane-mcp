import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "acorn";
import { z } from "zod";

import { ActionTool, ToolKind } from "../types.js";
import { createSimpleResponse } from "../responses/index.js";

const FUNCTION_NODE_TYPES = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);

type AsyncFunctionConstructor = new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as AsyncFunctionConstructor;

interface ParsedNode {
    type: string;
    start: number;
    end: number;
    body?: ParsedNode[];
    expression?: ParsedNode;
}

interface ParsedExpression {
    type: string;
    code: string;
}

export const runCodeSchema = {
    code: z
        .string()
        .optional()
        .describe(
            'JavaScript code to run. It may be an expression like "await browser.getUrl()" or a function like "(browser) => browser.getUrl()".',
        ),
    file: z.string().optional().describe("Path to a JavaScript file to run instead of inline code"),
};

function parseSingleExpression(source: string): ParsedExpression | null {
    try {
        const program = parse(source, { ecmaVersion: "latest", allowAwaitOutsideFunction: true }) as ParsedNode;
        const statements = (program.body ?? []).filter(statement => statement.type !== "EmptyStatement");

        if (statements.length === 1) {
            const statement = statements[0];

            if (statement.type === "ExpressionStatement" && statement.expression) {
                return {
                    type: statement.expression.type,
                    code: source.slice(statement.expression.start, statement.expression.end),
                };
            }

            if (statement.type === "FunctionDeclaration") {
                return {
                    type: statement.type,
                    code: source.slice(statement.start, statement.end),
                };
            }
        }
    } catch {
        // Fall back to parenthesized expression parsing below.
    }

    try {
        const program = parse(`(${source})`, { ecmaVersion: "latest", allowAwaitOutsideFunction: true }) as ParsedNode;
        const statement = program.body?.[0];
        const expression = statement?.type === "ExpressionStatement" ? statement.expression : undefined;

        if (expression) {
            return { type: expression.type, code: source };
        }
    } catch {
        return null;
    }

    return null;
}

async function runExpression(expressionCode: string, browser: unknown): Promise<unknown> {
    const fn = new AsyncFunction("browser", `"use strict";\nreturn (${expressionCode});`);

    return fn(browser);
}

async function runBody(code: string, browser: unknown): Promise<unknown> {
    const fn = new AsyncFunction("browser", `"use strict";\n${code}`);

    return fn(browser);
}

async function executeSource(source: string, browser: unknown): Promise<unknown> {
    const parsedExpression = parseSingleExpression(source);

    if (parsedExpression && FUNCTION_NODE_TYPES.has(parsedExpression.type)) {
        const fn = await runExpression(parsedExpression.code, browser);

        if (typeof fn !== "function") {
            throw new Error(`Expected input to evaluate to a function, got ${typeof fn}`);
        }

        return fn(browser);
    }

    if (parsedExpression) {
        return runExpression(parsedExpression.code, browser);
    }

    return runBody(source, browser);
}

function serializeError(error: unknown): Record<string, unknown> {
    if (!(error instanceof Error)) {
        return {
            name: typeof error,
            message: String(error),
        };
    }

    const serialized: Record<string, unknown> = {
        name: error.name,
        message: error.message,
    };

    if (error.stack) {
        serialized.stack = error.stack;
    }

    const errorProps = error as unknown as Record<string, unknown>;
    for (const key of Object.keys(errorProps)) {
        serialized[key] = errorProps[key];
    }

    return serialized;
}

function json(payload: unknown): string {
    const seen = new WeakSet<object>();

    return JSON.stringify(
        payload,
        (_key, value) => {
            if (typeof value === "bigint") {
                return value.toString();
            }

            if (typeof value === "function") {
                return `[Function${value.name ? `: ${value.name}` : ""}]`;
            }

            if (typeof value === "undefined") {
                return null;
            }

            if (value instanceof Error) {
                return serializeError(value);
            }

            if (value && typeof value === "object") {
                if (seen.has(value)) {
                    return "[Circular]";
                }

                seen.add(value);
            }

            return value;
        },
        2,
    );
}

async function getSource(args: { code?: string; file?: string }): Promise<string> {
    if (args.code !== undefined && args.file !== undefined) {
        throw new Error("Pass either code or --file, not both");
    }

    if (args.code !== undefined) {
        return args.code;
    }

    if (args.file === undefined) {
        throw new Error("Pass code or --file");
    }

    const filePath = path.isAbsolute(args.file) ? args.file : path.resolve(process.cwd(), args.file);

    return readFile(filePath, "utf8");
}

const runCodeCb: ActionTool<typeof runCodeSchema>["cb"] = async (args, browser) => {
    try {
        const source = await getSource(args);
        const result = await executeSource(source, browser);

        return createSimpleResponse(json({ result }));
    } catch (error) {
        return createSimpleResponse(json({ error: serializeError(error) }), true);
    }
};

export const runCode: ActionTool<typeof runCodeSchema> = {
    kind: ToolKind.Action,
    name: "run-code",
    description:
        "Run arbitrary Testplane script using the current browser, useful when other tools don't provide the functionality you need. " +
        "Inline input may be code or a function that receives browser as its only argument.",
    schema: runCodeSchema,
    cb: runCodeCb,
    cli: {
        positional: ["code"],
        section: "Advanced",
        usage: "[options] [code]",
        examples: [
            'testplane-cli run-code "await browser.getUrl()"',
            'testplane-cli run-code "(browser) => browser.getUrl()"',
            "testplane-cli run-code --file ./script.js",
        ],
    },
};
