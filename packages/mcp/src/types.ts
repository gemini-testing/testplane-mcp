import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodRawShape } from "zod";
import { BrowserContext } from "./browser-context.js";

export interface Context {
    browser: BrowserContext;
}

export type ToolDefinition<T extends ZodRawShape> = {
    name: string;
    description: string;
    schema: T;
    cb: ToolCallback<T>;
};
