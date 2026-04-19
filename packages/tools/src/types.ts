import { z, ZodRawShape } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { WdioBrowser } from "testplane";
import type { StandaloneBrowserOptionsInput } from "testplane/unstable";

export type ToolArgs<S extends ZodRawShape> = z.objectOutputType<S, z.ZodTypeAny>;
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
}

export interface ActionTool<S extends ZodRawShape> {
    name: string;
    description: string;
    schema: S;
    cb: (args: ToolArgs<S>, browser: WdioBrowser) => Promise<ToolResponse>;
    cli?: CliHints<S>;
}

export interface SessionOpenResult {
    browser: WdioBrowser | null;
    options: BrowserOptions;
    response: ToolResponse;
}

export interface SessionOpenTool<S extends ZodRawShape> {
    name: string;
    description: string;
    schema: S;
    cb: (args: ToolArgs<S>, previousOptions: BrowserOptions) => Promise<SessionOpenResult>;
    cli?: CliHints<S>;
}

export interface SessionCloseTool<S extends ZodRawShape> {
    name: string;
    description: string;
    schema: S;
    cb: (args: ToolArgs<S>, browser: WdioBrowser | null) => Promise<ToolResponse>;
    cli?: CliHints<S>;
}
