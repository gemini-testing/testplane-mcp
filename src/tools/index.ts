import { ToolDefinition } from "../types.js";
import { navigate } from "./navigate.js";
import { closeBrowser } from "./close-browser.js";

export const tools = [navigate, closeBrowser] as const satisfies ToolDefinition<any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
