import { ToolDefinition } from "../types.js";
import { navigate } from "./navigate.js";
import { closeBrowser } from "./close-browser.js";
import { clickOnElement } from "./click-on-element.js";
import { typeIntoElement } from "./type-into-element.js";
import { takePageSnapshot } from "./take-page-snapshot.js";
import { listTabs } from "./list-tabs.js";
import { switchToTab } from "./switch-to-tab.js";
import { openNewTab } from "./open-new-tab.js";
import { closeTab } from "./close-tab.js";
import { waitForElement } from "./wait-for-element.js";

export const tools = [
    navigate,
    closeBrowser,
    clickOnElement,
    typeIntoElement,
    takePageSnapshot,
    listTabs,
    switchToTab,
    openNewTab,
    closeTab,
    waitForElement,
] as const satisfies ToolDefinition<any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
