import { z, ZodRawShape } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { WdioBrowser } from "testplane";
import type { StandaloneBrowserOptionsInput } from "testplane/unstable";

export type ToolArgs<S extends ZodRawShape> = z.objectInputType<S, z.ZodTypeAny>;
export type ToolResponse = CallToolResult;

export interface BrowserOptions {
    headless?: boolean;
    desiredCapabilities?: StandaloneBrowserOptionsInput["desiredCapabilities"];
    gridUrl?: string;
    windowSize?: StandaloneBrowserOptionsInput["windowSize"];
}

export interface CliHints<S extends ZodRawShape = ZodRawShape> {
    /**
     * Ordered list of schema field names that should be exposed as CLI positional
     * arguments instead of flags. Each entry must be a key of the tool's schema.
     * Required-ness of each positional follows the field's zod schema.
     */
    positional?: (keyof S & string)[];
    /** Section name for grouping this tool in the CLI help output. Tools without a section appear under "Other". */
    section?: string;
    /** Custom command usage string for CLI help. */
    usage?: string;
    /** Example invocations shown in CLI help. */
    examples?: string[];
}

export enum ToolKind {
    Action = "action",
    SessionOpen = "session-open",
    SessionClose = "session-close",
}

interface ToolBase<S extends ZodRawShape> {
    kind: ToolKind;
    name: string;
    description: string;
    schema: S;
    cli?: CliHints<S>;
}

export interface ActionTool<S extends ZodRawShape> extends ToolBase<S> {
    kind: ToolKind.Action;
    cb: (args: ToolArgs<S>, browser: WdioBrowser) => Promise<ToolResponse>;
}

export interface SessionOpenResult {
    browser: WdioBrowser | null;
    options: BrowserOptions;
    response: ToolResponse;
}

export interface SessionOpenTool<S extends ZodRawShape> extends ToolBase<S> {
    kind: ToolKind.SessionOpen;
    cb: (args: ToolArgs<S>, previousOptions: BrowserOptions) => Promise<SessionOpenResult>;
}

export interface SessionCloseTool<S extends ZodRawShape> extends ToolBase<S> {
    kind: ToolKind.SessionClose;
    cb: (args: ToolArgs<S>, browser: WdioBrowser | null) => Promise<ToolResponse>;
}

export type Tool<S extends ZodRawShape> = ActionTool<S> | SessionOpenTool<S> | SessionCloseTool<S>;
