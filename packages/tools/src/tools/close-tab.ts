import { z } from "zod";
import { ActionTool } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";
import { getBrowserTabs } from "../responses/browser-helpers.js";

export const closeTabSchema = {
    tabNumber: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("The number of the tab to close (starting from 1). If not provided, closes the current tab"),
};

const closeTabCb: ActionTool<typeof closeTabSchema>["cb"] = async (args, browser) => {
    try {
        const { tabNumber } = args;
        const windowHandles = await browser.getWindowHandles();

        if (windowHandles.length === 0) {
            return createErrorResponse("Cannot close tab — no tabs are currently open");
        }

        if (windowHandles.length === 1) {
            return createErrorResponse(
                'Cannot close tab — this is the last remaining tab. Use "close-browser" command to close the entire browser session.',
            );
        }

        let targetTabNumber: number;
        const currentHandle = await browser.getWindowHandle();
        const currentIndex = windowHandles.indexOf(currentHandle);

        if (tabNumber) {
            if (tabNumber > windowHandles.length) {
                return createErrorResponse(
                    `Cannot close tab — tab number ${tabNumber} is out of range. Available range: 1-${windowHandles.length}`,
                );
            }
            targetTabNumber = tabNumber;
        } else {
            targetTabNumber = currentIndex + 1;
        }

        const tabs = await getBrowserTabs(browser);
        const tabToClose = tabs[targetTabNumber - 1];

        await browser.switchToWindow(windowHandles[targetTabNumber - 1]);
        await browser.closeWindow();

        if (tabNumber && tabNumber !== currentIndex + 1) {
            await browser.switchToWindow(currentHandle);
        } else {
            const remainingHandles = await browser.getWindowHandles();
            await browser.switchToWindow(remainingHandles[0]);
        }

        const actionMessage = `Closed tab ${targetTabNumber}: ${tabToClose.title} (URL: ${tabToClose.url})`;
        const testplaneCode = tabNumber
            ? `// Close specific tab by number\nconst windowHandles = await browser.getWindowHandles();\nawait browser.switchToWindow(windowHandles[${targetTabNumber - 1}]);\nawait browser.closeWindow();`
            : `// Close current tab\nawait browser.closeWindow();`;

        return await createBrowserStateResponse(browser, {
            action: actionMessage,
            testplaneCode,
            isSnapshotNeeded: false,
        });
    } catch (error) {
        console.error("Error closing tab:", error);
        return createErrorResponse("Error closing tab", error instanceof Error ? error : undefined);
    }
};

export const closeTab: ActionTool<typeof closeTabSchema> = {
    name: "close-tab",
    description:
        "Close a specific browser tab by its number (1-based), or close the current tab if no number is provided",
    schema: closeTabSchema,
    cb: closeTabCb,
};
