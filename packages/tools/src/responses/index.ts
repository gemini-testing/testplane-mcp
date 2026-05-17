import { WdioBrowser } from "testplane";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    CaptureSnapshotOptions,
    getPageSnapshot,
    getBrowserTabs,
    convertSnapshotToResponse,
} from "./browser-helpers.js";

export type ToolResponse = CallToolResult;

export interface BrowserResponseOptions {
    action?: string;
    testplaneCode?: string;
    additionalInfo?: string;
    snapshotOptions?: CaptureSnapshotOptions;
    isSnapshotNeeded?: boolean;
    inlineSnapshot?: boolean;
}

export function createSimpleResponse(message: string, isError = false): ToolResponse {
    return {
        content: [
            {
                type: "text",
                text: message,
            },
        ],
        isError,
    };
}

export async function createBrowserStateResponse(
    browser: WdioBrowser,
    options: BrowserResponseOptions,
): Promise<ToolResponse> {
    const sections: string[] = [];

    if (options.action) {
        sections.push(`✅ ${options.action}`);
    }

    if (options.testplaneCode) {
        sections.push("## Testplane Code");
        sections.push("```javascript");
        sections.push(options.testplaneCode);
        sections.push("```");
    }

    const tabs = await getBrowserTabs(browser);
    if (tabs.length > 0) {
        sections.push("## Browser Tabs");
        tabs.forEach((tab, index) => {
            const activeIndicator = tab.isActive ? "(current)" : "";
            sections.push(`  ${index + 1}. Title: ${tab.title}; URL: ${tab.url} ${activeIndicator}`);
        });
    } else {
        sections.push("## Browser Tabs");
        sections.push("No opened tabs");
    }

    if (options.isSnapshotNeeded !== false) {
        const snapshot = await getPageSnapshot(browser, options.snapshotOptions);
        if (!snapshot) {
            sections.push("## Current Tab Snapshot");
            sections.push("No snapshot captured");
        } else {
            const response = await convertSnapshotToResponse(snapshot, { forceSaveToFile: !options.inlineSnapshot });
            sections.push("## Current Tab Snapshot");
            sections.push(response);
        }
    }

    if (options.additionalInfo) {
        sections.push("## Additional Information");
        sections.push(options.additionalInfo);
    }

    return createSimpleResponse(sections.join("\n\n"));
}

export function createErrorResponse(message: string, error?: Error): ToolResponse {
    const errorMessage = error ? `${message}: ${error.message}` : message;

    return {
        content: [
            {
                type: "text",
                text: `❌ ${errorMessage}`,
            },
        ],
        isError: true,
    };
}
