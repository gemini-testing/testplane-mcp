import makeDebug from "debug";
import { z } from "zod";
import { launchBrowserWithOptions, ToolKind, tools } from "@testplane/tools";
import { SessionRegistry } from "./session-registry.js";
import type { Request, Response } from "../ipc/protocol.js";
import { formatError } from "../utils/error.js";

const debug = makeDebug("testplane-cli:daemon:request-handler");

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
            parsedArgs = z.object(tool.schema).parse(req.args);
        } catch (error) {
            const message = formatError(error);
            debug("Invalid arguments: id=%d tool=%s message=%s", req.id, req.tool, message);

            return { id: req.id, kind: "error", code: "INVALID_ARGS", message };
        }

        const state = sessions.getOrCreate(req.sessionName);

        try {
            if (tool.kind === ToolKind.Action) {
                if (!state.browser) {
                    debug("Auto-launching browser: session=%s", req.sessionName);
                    state.browser = await launchBrowserWithOptions(state.options);
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await tool.cb(parsedArgs as any, state.browser);

                return { id: req.id, kind: "result", content: result.content, isError: result.isError };
            }

            if (tool.kind === ToolKind.SessionOpen) {
                if (state.browser) {
                    debug("Replacing existing browser session: session=%s", req.sessionName);

                    try {
                        await state.browser.deleteSession();
                    } catch (error) {
                        debug(
                            "Error closing previous session: session=%s message=%s",
                            req.sessionName,
                            formatError(error),
                        );
                    }

                    state.browser = null;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const openResult = await tool.cb(parsedArgs as any, state.options);
                if (openResult.browser) {
                    state.browser = openResult.browser;
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
            state.browser = null;

            return { id: req.id, kind: "result", content: closeResult.content, isError: closeResult.isError };
        } catch (error) {
            const message = formatError(error);
            debug("Tool error: id=%d tool=%s message=%s", req.id, req.tool, message);

            return { id: req.id, kind: "error", code: "TOOL_ERROR", message };
        }
    }
}
