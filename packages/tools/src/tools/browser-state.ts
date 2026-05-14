import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { SaveStateData, WdioBrowser } from "testplane";

import { ActionTool, ToolKind } from "../types.js";
import { createBrowserStateResponse, createErrorResponse } from "../responses/index.js";

type BrowserWithState = WdioBrowser & {
    saveState(options?: {
        cookies?: boolean;
        localStorage?: boolean;
        sessionStorage?: boolean;
    }): Promise<SaveStateData>;
    restoreState(options?: { data?: SaveStateData; refresh?: boolean }): Promise<void>;
};

interface StateSummary {
    cookies: number;
    origins: number;
    localStorageItems: number;
    sessionStorageItems: number;
}

const filePathSchema = z
    .string()
    .trim()
    .min(1, "Path must not be empty")
    .describe(
        "Path to the JSON file with saved browser state. Relative paths are resolved from the current working directory.",
    );

export const saveStateSchema = {
    path: filePathSchema,
    cookies: z.boolean().optional().describe("Whether to include cookies in the saved state. Default: true"),
    localStorage: z.boolean().optional().describe("Whether to include localStorage in the saved state. Default: true"),
    sessionStorage: z
        .boolean()
        .optional()
        .describe("Whether to include sessionStorage in the saved state. Default: true"),
};

export const restoreStateSchema = {
    path: filePathSchema,
    refresh: z
        .boolean()
        .optional()
        .describe(
            "Whether to reload the current page after restoring state. Default: true. Reloading makes the page observe restored cookies and storage immediately.",
        ),
};

function resolveStatePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function getStateSummary(data: SaveStateData): StateSummary {
    const framesData = data.framesData ?? {};
    const frameValues = Object.values(framesData);

    return {
        cookies: data.cookies?.length ?? 0,
        origins: Object.keys(framesData).length,
        localStorageItems: frameValues.reduce(
            (count, frameData) => count + Object.keys(frameData.localStorage ?? {}).length,
            0,
        ),
        sessionStorageItems: frameValues.reduce(
            (count, frameData) => count + Object.keys(frameData.sessionStorage ?? {}).length,
            0,
        ),
    };
}

function formatStateSummary(summary: StateSummary): string {
    return [
        `Cookies: ${summary.cookies}`,
        `Origins with storage: ${summary.origins}`,
        `localStorage items: ${summary.localStorageItems}`,
        `sessionStorage items: ${summary.sessionStorageItems}`,
    ].join("\n");
}

function ensureSaveStateData(data: unknown): SaveStateData {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("State file must contain a JSON object");
    }

    const record = data as Record<string, unknown>;
    if (record.cookies !== undefined && !Array.isArray(record.cookies)) {
        throw new Error('"cookies" must be an array when present');
    }

    if (!record.framesData || typeof record.framesData !== "object" || Array.isArray(record.framesData)) {
        throw new Error('"framesData" must be an object');
    }

    return data as SaveStateData;
}

function stringifyState(data: SaveStateData): string {
    return JSON.stringify(data, null, 2) + "\n";
}

function createSaveOptions(args: { cookies?: boolean; localStorage?: boolean; sessionStorage?: boolean }): {
    cookies?: boolean;
    localStorage?: boolean;
    sessionStorage?: boolean;
} {
    const options: {
        cookies?: boolean;
        localStorage?: boolean;
        sessionStorage?: boolean;
    } = {};

    if (args.cookies !== undefined) {
        options.cookies = args.cookies;
    }
    if (args.localStorage !== undefined) {
        options.localStorage = args.localStorage;
    }
    if (args.sessionStorage !== undefined) {
        options.sessionStorage = args.sessionStorage;
    }

    return options;
}

const saveStateCb: ActionTool<typeof saveStateSchema, BrowserWithState>["cb"] = async (args, browser) => {
    try {
        const resolvedPath = resolveStatePath(args.path);
        const saveOptions = createSaveOptions(args);
        const data = await browser.saveState(saveOptions);

        await mkdir(path.dirname(resolvedPath), { recursive: true });
        await writeFile(resolvedPath, stringifyState(data), "utf8");

        return await createBrowserStateResponse(browser, {
            action: `Saved browser state to ${resolvedPath}`,
            testplaneCode: `const state = await browser.saveState(${JSON.stringify(saveOptions, null, 2)});`,
            additionalInfo: formatStateSummary(getStateSummary(data)),
            isSnapshotNeeded: false,
        });
    } catch (error) {
        console.error("Error saving browser state:", error);
        return createErrorResponse("Error saving browser state", error instanceof Error ? error : undefined);
    }
};

const restoreStateCb: ActionTool<typeof restoreStateSchema, BrowserWithState>["cb"] = async (args, browser) => {
    try {
        const resolvedPath = resolveStatePath(args.path);
        const data = ensureSaveStateData(JSON.parse(await readFile(resolvedPath, "utf8")));
        const refresh = args.refresh ?? true;

        await browser.restoreState({
            data,
            refresh,
        });

        return await createBrowserStateResponse(browser, {
            action: `Restored browser state from ${resolvedPath}`,
            testplaneCode: `await browser.restoreState({ data: state, refresh: ${JSON.stringify(refresh)} });`,
            additionalInfo: [
                formatStateSummary(getStateSummary(data)),
                `Refresh: ${refresh ? "enabled" : "disabled"}${
                    refresh
                        ? " - the current page was reloaded after restore so it can read the restored state."
                        : " - the current page was not reloaded after restore."
                }`,
            ].join("\n"),
            isSnapshotNeeded: false,
        });
    } catch (error) {
        console.error("Error restoring browser state:", error);
        return createErrorResponse("Error restoring browser state", error instanceof Error ? error : undefined);
    }
};

export const saveState: ActionTool<typeof saveStateSchema, BrowserWithState> = {
    kind: ToolKind.Action,
    name: "save-state",
    description: "Save the current browser state, including cookies and web storage, to a JSON file",
    supportedTransports: ["launch-browser"],
    schema: saveStateSchema,
    cb: saveStateCb,
    cli: {
        positional: ["path"],
        section: "State",
    },
};

export const restoreState: ActionTool<typeof restoreStateSchema, BrowserWithState> = {
    kind: ToolKind.Action,
    name: "restore-state",
    description:
        "Restore browser state from a JSON file. By default the page is refreshed after restore so it can observe restored cookies and web storage.",
    supportedTransports: ["launch-browser"],
    schema: restoreStateSchema,
    cb: restoreStateCb,
    cli: {
        positional: ["path"],
        section: "State",
    },
};
