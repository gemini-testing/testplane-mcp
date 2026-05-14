import { z } from "zod";
import { SessionOpenTool, ToolKind } from "../types.js";
import { createErrorResponse, createSimpleResponse } from "../responses/index.js";
import { ReplConnection } from "../browser/repl-connection.js";
import { ReplBrowser } from "../browser/repl-browser.js";

const DEFAULT_REPL_HOST = "127.0.0.1";

export const attachReplSchema = {
    port: z.number().int().positive().describe("Testplane REPL TCP port"),
    host: z.string().default(DEFAULT_REPL_HOST).describe("Testplane REPL TCP host"),
};

const attachReplCb: SessionOpenTool<typeof attachReplSchema>["cb"] = async (args, previousOptions) => {
    const host = args.host ?? DEFAULT_REPL_HOST;
    const connection = new ReplConnection({ host, port: args.port });
    const browser = new ReplBrowser(connection);

    try {
        await connection.connect();
        await browser.getUrl();

        return {
            browser,
            options: previousOptions,
            transport: "attach-repl" as const,
            response: createSimpleResponse(`Attached to Testplane REPL at ${host}:${args.port}`),
        };
    } catch (error) {
        await connection.close().catch(() => undefined);

        return {
            browser: null,
            options: previousOptions,
            response: createErrorResponse(
                "Error attaching to Testplane REPL",
                error instanceof Error ? error : undefined,
            ),
        };
    }
};

export const attachRepl: SessionOpenTool<typeof attachReplSchema> = {
    kind: ToolKind.SessionOpen,
    name: "attach-repl",
    description: "Attach to a running Testplane REPL session",
    schema: attachReplSchema,
    cb: attachReplCb,
    cli: { section: "Session" },
};
