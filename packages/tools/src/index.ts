import { Tool, ToolKind } from "./types.js";
import { navigate } from "./tools/navigate.js";
import { clickOnElement } from "./tools/click-on-element.js";
import { hoverElement } from "./tools/hover-element.js";
import { typeIntoElement } from "./tools/type-into-element.js";
import { selectOption } from "./tools/select-option.js";
import { waitForElement } from "./tools/wait-for-element.js";
import { takePageSnapshot } from "./tools/take-page-snapshot.js";
import { takeViewportScreenshot } from "./tools/take-viewport-screenshot.js";
import { listTabs } from "./tools/list-tabs.js";
import { switchToTab } from "./tools/switch-to-tab.js";
import { openNewTab } from "./tools/open-new-tab.js";
import { closeTab } from "./tools/close-tab.js";
import { launchBrowser, launchBrowserWithOptions } from "./tools/launch-browser.js";
import { attachToBrowser } from "./tools/attach-to-browser.js";
import { closeBrowser } from "./tools/close-browser.js";

// This function just ensures that every item on a type level is a Tool<something>. AFAIK the only way to do this.
const typeCheckedTools = <const T extends readonly unknown[]>(
    tools: T & { [K in keyof T]: T[K] extends Tool<infer _S> ? T[K] : never }, // eslint-disable-line @typescript-eslint/no-unused-vars
) => tools;

export const tools = typeCheckedTools([
    navigate,
    clickOnElement,
    hoverElement,
    typeIntoElement,
    selectOption,
    waitForElement,
    takePageSnapshot,
    takeViewportScreenshot,
    listTabs,
    switchToTab,
    openNewTab,
    closeTab,
    launchBrowser,
    attachToBrowser,
    closeBrowser,
]);

export { launchBrowserWithOptions, ToolKind };

export type {
    Tool,
    ActionTool,
    SessionOpenTool,
    SessionCloseTool,
    SessionOpenResult,
    BrowserOptions,
    ToolArgs,
    ToolResponse,
} from "./types.js";
