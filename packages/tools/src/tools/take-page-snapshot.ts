import { z } from "zod";
import { ActionTool } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

export const takePageSnapshotSchema = {
    includeTags: z.array(z.string()).optional().describe("HTML tags to include in the snapshot besides defaults"),
    includeAttrs: z
        .array(z.string())
        .optional()
        .describe("HTML attributes to include in the snapshot besides defaults"),
    excludeTags: z.array(z.string()).optional().describe("HTML tags to exclude from the snapshot"),
    excludeAttrs: z.array(z.string()).optional().describe("HTML attributes to exclude from the snapshot"),
    truncateText: z.boolean().optional().describe("Whether to truncate long text content (default: true)"),
    maxTextLength: z.number().positive().optional().describe("Maximum length of text content before truncation"),
};

const takePageSnapshotCb: ActionTool<typeof takePageSnapshotSchema>["cb"] = async (args, browser) => {
    try {
        const snapshotOptions = {
            includeTags: args.includeTags,
            includeAttrs: args.includeAttrs,
            excludeTags: args.excludeTags,
            excludeAttrs: args.excludeAttrs,
            truncateText: args.truncateText,
            maxTextLength: args.maxTextLength,
        };

        const testplaneCode = `const snapshot = await browser.unstable_captureDomSnapshot(${JSON.stringify(snapshotOptions, null, 2)});`;

        return await createBrowserStateResponse(browser, {
            action: "Page snapshot captured successfully",
            testplaneCode,
            snapshotOptions,
        });
    } catch (error) {
        console.error("Error taking page snapshot:", error);
        return createErrorResponse("Error taking page snapshot", error instanceof Error ? error : undefined);
    }
};

export const takePageSnapshot: ActionTool<typeof takePageSnapshotSchema> = {
    name: "snapshot",
    description:
        "Capture a DOM snapshot of the current page. Note: by default, not useful tags and attributes are excluded (e.g. script, style, etc.). Prefer to use defaults. Response contains info as to what was omitted. If you need more info, request a snapshot with more tags and attributes.",
    schema: takePageSnapshotSchema,
    cb: takePageSnapshotCb,
};
