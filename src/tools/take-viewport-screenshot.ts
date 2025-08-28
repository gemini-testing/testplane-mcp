import { z } from "zod";
import { ToolDefinition } from "../types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextProvider } from "../context-provider.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";
import path from "path";
import fs from "fs/promises";
import os from "os";

export const takeViewportScreenshotSchema = {
    filePath: z.string().optional().describe("Path to save the screenshot (defaults to tmp directory)"),
};

const takeViewportScreenshotCb: ToolCallback<typeof takeViewportScreenshotSchema> = async args => {
    try {
        const context = contextProvider.getContext();
        const browser = await context.browser.get();

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const defaultFilePath = path.join(os.tmpdir(), `viewport-${timestamp}.png`);
        const filePath = args.filePath || defaultFilePath;

        const screenshotDir = path.dirname(filePath);
        await fs.mkdir(screenshotDir, { recursive: true });

        await browser.saveScreenshot(filePath);

        const fileStats = await fs.stat(filePath);
        const fileSizeKB = Math.round(fileStats.size / 1024);

        const additionalInfo = `Screenshot saved: ${filePath} (${fileSizeKB} KB)`;

        return await createBrowserStateResponse(browser, {
            action: "Viewport screenshot captured successfully",
            testplaneCode: `await browser.saveScreenshot("${filePath}");`,
            additionalInfo,
            isSnapshotNeeded: false,
        });
    } catch (error) {
        console.error("Error taking viewport screenshot:", error);
        return createErrorResponse("Error taking viewport screenshot", error instanceof Error ? error : undefined);
    }
};

export const takeViewportScreenshot: ToolDefinition<typeof takeViewportScreenshotSchema> = {
    name: "takeViewportScreenshot",
    description:
        "Capture a PNG screenshot of the current browser viewport. " +
        "Strongly prefer capturing text-based snapshots using takePageSnapshot tool. " +
        "Only use to test for visual changes when text-based snapshots are not useful.",
    schema: takeViewportScreenshotSchema,
    cb: takeViewportScreenshotCb,
};
