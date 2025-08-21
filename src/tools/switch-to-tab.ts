import { z } from "zod";
import { ToolDefinition } from "../types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextProvider } from "../context-provider.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";
import { getBrowserTabs } from "../responses/browser-helpers.js";

export const switchToTabSchema = {
    tabNumber: z.number().int().min(1).describe("The number of the tab to switch to (starting from 1)"),
};

const switchToTabCb: ToolCallback<typeof switchToTabSchema> = async args => {
    try {
        const { tabNumber } = args;
        const context = contextProvider.getContext();

        if (!(await context.browser.isActive())) {
            return createErrorResponse(
                "Cannot switch to tab — browser is not launched yet. Try opening a tab or navigating to URL.",
            );
        }

        const browser = await context.browser.get();
        const windowHandles = await browser.getWindowHandles();

        if (windowHandles.length === 0) {
            return createErrorResponse("Cannot switch to tab — no tabs are currently open");
        }

        if (tabNumber > windowHandles.length) {
            return createErrorResponse(
                `Cannot switch to tab — tab number ${tabNumber} is out of range. Available range: 1-${windowHandles.length}`,
            );
        }

        const arrayIndex = tabNumber - 1;
        const targetHandle = windowHandles[arrayIndex];
        const currentHandle = await browser.getWindowHandle();

        if (targetHandle === currentHandle) {
            return createBrowserStateResponse(browser, {
                action: `Already on tab ${tabNumber}`,
                isSnapshotNeeded: false,
            });
        }

        await browser.switchToWindow(targetHandle);

        const tabs = await getBrowserTabs(browser);
        const switchedTab = tabs[arrayIndex];

        return await createBrowserStateResponse(browser, {
            action: `Switched to tab ${tabNumber}: ${switchedTab.title}, URL: ${switchedTab.url}`,
            testplaneCode: `// In actual test code, you may want to search for the tab by its name or URL
// Switch to tab by index
const windowHandles = await browser.getWindowHandles();
await browser.switchToWindow(windowHandles[${arrayIndex}]);`,
            isSnapshotNeeded: false,
        });
    } catch (error) {
        console.error("Error switching to tab:", error);
        return createErrorResponse("Error switching to tab", error instanceof Error ? error : undefined);
    }
};

export const switchToTab: ToolDefinition<typeof switchToTabSchema> = {
    name: "switchToTab",
    description: "Switch to a specific browser tab by its number (starting from 1)",
    schema: switchToTabSchema,
    cb: switchToTabCb,
};
