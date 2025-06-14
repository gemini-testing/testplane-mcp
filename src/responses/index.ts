import { WdioBrowser } from "testplane";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    CaptureSnapshotOptions,
    getBrowserTabs,
    getCurrentTabSnapshot,
    getElementSnapshot,
} from "./browser-helpers.js";

export type ToolResponse = CallToolResult;

export interface BrowserResponseOptions {
    action?: string;
    testplaneCode?: string;
    additionalInfo?: string;
    snapshotOptions?: CaptureSnapshotOptions;
}

export interface ElementResponseOptions {
    action?: string;
    testplaneCode?: string;
    additionalInfo?: string;
    snapshotOptions?: CaptureSnapshotOptions;
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
    }

    const snapshot = await getCurrentTabSnapshot(browser, options.snapshotOptions);
    if (snapshot) {
        sections.push("## Current Tab Snapshot");
        sections.push(snapshot);
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

export async function createElementStateResponse(
    element: WebdriverIO.Element,
    options: ElementResponseOptions,
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

    const elementSnapshot = await getElementSnapshot(element, options.snapshotOptions);
    if (elementSnapshot) {
        sections.push("## Element Snapshot");
        sections.push(elementSnapshot);
    }

    if (options.additionalInfo) {
        sections.push("## Additional Information");
        sections.push(options.additionalInfo);
    }

    return createSimpleResponse(sections.join("\n\n"));
}
