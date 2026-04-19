import { ActionTool, SessionOpenTool, SessionCloseTool } from "./types.js";
import { navigate } from "./tools/navigate.js";
import { clickOnElement } from "./tools/click-on-element.js";
import { hoverElement } from "./tools/hover-element.js";
import { typeIntoElement } from "./tools/type-into-element.js";
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

/* eslint-disable @typescript-eslint/no-explicit-any */
export const actionTools = [
    navigate,
    clickOnElement,
    hoverElement,
    typeIntoElement,
    waitForElement,
    takePageSnapshot,
    takeViewportScreenshot,
    listTabs,
    switchToTab,
    openNewTab,
    closeTab,
] as const satisfies ActionTool<any>[];

export const sessionOpenTools = [launchBrowser, attachToBrowser] as const satisfies SessionOpenTool<any>[];

export const sessionCloseTools = [closeBrowser] as const satisfies SessionCloseTool<any>[];
/* eslint-enable @typescript-eslint/no-explicit-any */

export { launchBrowserWithOptions };

export type {
    ActionTool,
    SessionOpenTool,
    SessionCloseTool,
    SessionOpenResult,
    BrowserOptions,
    ToolArgs,
    ToolResponse,
} from "./types.js";
