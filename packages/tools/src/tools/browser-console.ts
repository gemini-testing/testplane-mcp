import type { WdioBrowser } from "testplane";
import { ActionTool, ToolKind } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const browserConsoleSchema = {};

interface BrowserLogEntry {
    level?: string;
    message?: string;
    source?: string;
    timestamp?: number;
}

type BrowserWithLogs = WdioBrowser & {
    getLogTypes?: () => Promise<string[]>;
    getLogs?: (type: "browser") => Promise<BrowserLogEntry[]>;
};

function isChromiumBasedBrowser(browser: WdioBrowser): boolean {
    const capabilities = browser.capabilities as { browserName?: string };
    const browserName = capabilities.browserName?.toLowerCase() ?? "";

    return ["chrome", "chromium", "edge", "microsoftedge", "msedge", "yandex"].some(name => browserName.includes(name));
}

function formatTimestamp(timestamp?: number): string {
    if (timestamp === undefined) {
        return "unknown time";
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return String(timestamp);
    }

    return date.toISOString();
}

function formatConsoleMessages(messages: BrowserLogEntry[]): string {
    if (messages.length === 0) {
        return "No unseen browser console messages were returned by the browser driver.";
    }

    return messages
        .map((message, index) => {
            const level = message.level ?? "UNKNOWN";
            const source = message.source ? ` (${message.source})` : "";
            const text = message.message ?? "";

            return `${index + 1}. [${formatTimestamp(message.timestamp)}] ${level}${source}: ${text}`;
        })
        .join("\n");
}

const browserConsoleCb: ActionTool<typeof browserConsoleSchema>["cb"] = async (_args, browser) => {
    try {
        const browserWithLogs = browser as BrowserWithLogs;

        if (
            !isChromiumBasedBrowser(browser) ||
            typeof browserWithLogs.getLogs !== "function" ||
            (typeof browserWithLogs.getLogTypes === "function" &&
                !(await browserWithLogs.getLogTypes()).includes("browser"))
        ) {
            return createErrorResponse(
                "Unable to get browser console messages: this browser is either not Chromium-based or the current session does not support getting browser logs.",
            );
        }

        const consoleMessages = await browserWithLogs.getLogs("browser");

        return await createBrowserStateResponse(browser, {
            action: `Retrieved ${consoleMessages.length} unseen browser console message${
                consoleMessages.length === 1 ? "" : "s"
            }`,
            testplaneCode: 'const consoleMessages = await browser.getLogs("browser");',
            additionalInfo: formatConsoleMessages(consoleMessages),
            isSnapshotNeeded: false,
        });
    } catch (error) {
        console.error("Error getting browser console messages:", error);
        return createErrorResponse(
            "Error getting browser console messages",
            error instanceof Error ? error : undefined,
        );
    }
};

export const browserConsole: ActionTool<typeof browserConsoleSchema> = {
    kind: ToolKind.Action,
    name: "console",
    description:
        "Get browser-side console messages. " +
        "This command only works with Chromium-based browsers " +
        'and returns only "unseen" messages - those that were not returned by the previous getLogs call in the current session.',
    supportedTransports: ["launch-browser"],
    schema: browserConsoleSchema,
    cb: browserConsoleCb,
    cli: { section: "Inspection" },
};
