import { ToolDefinition } from "../types.js";
import { navigate } from "./navigate.js";
import { closeBrowser } from "./close-browser.js";
import { clickOnElement } from "./click-on-element.js";
import { typeIntoElement } from "./type-into-element.js";

export const tools = [navigate, closeBrowser, clickOnElement, typeIntoElement] as const satisfies ToolDefinition<any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
