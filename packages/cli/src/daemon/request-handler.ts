import makeDebug from "debug";
import { z, type ZodRawShape } from "zod";
import { launchBrowserWithOptions, ToolKind, tools } from "@testplane/tools";
import { SessionRegistry } from "./session-registry.js";
import type { Request, Response, ResponseResult } from "../ipc/protocol.js";
import { formatError } from "../utils/error.js";

const debug = makeDebug("testplane-cli:daemon:request-handler");

function createNoActiveBrowserResponse(toolName: string): ResponseResult["content"] {
    return [
        {
            type: "text",
            text: `❌ No active browser session. Run "navigate <url>" to auto-start one, or run "launch" before "${toolName}".`,
        },
    ];
}

function createUnsupportedReplToolResponse(toolName: string): ResponseResult["content"] {
    return [
        {
            type: "text",
            text: `Tool '${toolName}' is not yet supported with REPL sessions. Currently supported in REPL mode: snapshot, run-code.`,
        },
    ];
}

async function closeBrowserSession(
    browser: NonNullable<ReturnType<SessionRegistry["getOrCreate"]>["browser"]>,
): Promise<void> {
    await browser.deleteSession();
}

/**
 * Handles requests from clients, executing tools in sessions as needed.
 */
export class RequestHandler {
    private readonly _requestsInProgress = new Set<Promise<Response>>();

    public getRequestsInProgress(): Set<Promise<Response>> {
        return this._requestsInProgress;
    }

    public async handleRequest(req: Request, sessions: SessionRegistry): Promise<Response> {
        const dispatchPromise = this._handleRequestImpl(req, sessions);

        this._requestsInProgress.add(dispatchPromise);

        void dispatchPromise.finally(() => {
            this._requestsInProgress.delete(dispatchPromise);
        });

        return dispatchPromise;
    }

    private async _handleRequestImpl(req: Request, sessions: SessionRegistry): Promise<Response> {
        const tool = tools.find(tool => tool.name === req.tool);
        if (!tool) {
            debug("Unknown tool: id=%d tool=%s", req.id, req.tool);

            return { id: req.id, kind: "error", code: "UNKNOWN_TOOL", message: `Unknown tool: ${req.tool}` };
        }

        let parsedArgs: unknown;
        try {
            parsedArgs = z.object(tool.schema as unknown as ZodRawShape).parse(req.args);
        } catch (error) {
            const message = formatError(error);
            debug("Invalid arguments: id=%d tool=%s message=%s", req.id, req.tool, message);

            return { id: req.id, kind: "error", code: "INVALID_ARGS", message };
        }

        if (tool.kind === ToolKind.Standalone) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await tool.cb(parsedArgs as any);

                return { id: req.id, kind: "result", content: result.content, isError: result.isError };
            } catch (error) {
                const message = formatError(error);
                debug("Tool error: id=%d tool=%s message=%s", req.id, req.tool, message);

                return { id: req.id, kind: "error", code: "TOOL_ERROR", message };
            }
        }

        const state = sessions.beginInteraction(req.sessionName);

        try {
            if (tool.kind === ToolKind.Action) {
                if (!state.browser) {
                    if (!tool.autoLaunchBrowser) {
                        debug("Action requires an active browser: session=%s tool=%s", req.sessionName, req.tool);

                        return {
                            id: req.id,
                            kind: "result",
                            content: createNoActiveBrowserResponse(tool.name),
                            isError: true,
                        };
                    }

                    debug("Auto-launching browser: session=%s tool=%s", req.sessionName, req.tool);
                    state.browser = await launchBrowserWithOptions(state.defaultOptions);
                    state.transport = "launch-browser";
                }

                const supportedTransports = tool.supportedTransports ?? ["launch-browser"];
                const transport = state.transport ?? "launch-browser";
                if (!supportedTransports.includes(transport)) {
                    debug(
                        "Action is not supported with current transport: session=%s tool=%s transport=%s",
                        req.sessionName,
                        req.tool,
                        transport,
                    );

                    return {
                        id: req.id,
                        kind: "result",
                        content: createUnsupportedReplToolResponse(tool.name),
                        isError: true,
                    };
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await tool.cb(parsedArgs as any, state.browser as never);

                return { id: req.id, kind: "result", content: result.content, isError: result.isError };
            }

            if (tool.kind === ToolKind.SessionOpen) {
                if (state.browser) {
                    debug("Replacing existing browser session: session=%s", req.sessionName);

                    try {
                        await closeBrowserSession(state.browser);
                    } catch (error) {
                        debug(
                            "Error closing previous session: session=%s message=%s",
                            req.sessionName,
                            formatError(error),
                        );
                    }

                    state.browser = null;
                    state.transport = null;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const openResult = await tool.cb(parsedArgs as any, state.options);
                if (openResult.browser) {
                    state.browser = openResult.browser;
                    state.transport = openResult.transport ?? "launch-browser";
                    state.options = openResult.options;
                }

                return {
                    id: req.id,
                    kind: "result",
                    content: openResult.response.content,
                    isError: openResult.response.isError,
                };
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const closeResult = await tool.cb(parsedArgs as any, state.browser);
            sessions.clearBrowser(req.sessionName, state);

            return { id: req.id, kind: "result", content: closeResult.content, isError: closeResult.isError };
        } catch (error) {
            const message = formatError(error);
            debug("Tool error: id=%d tool=%s message=%s", req.id, req.tool, message);

            return { id: req.id, kind: "error", code: "TOOL_ERROR", message };
        } finally {
            sessions.endInteraction(req.sessionName, state);
        }
    }
}
