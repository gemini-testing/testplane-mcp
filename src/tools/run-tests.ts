import { ToolDefinition } from "../types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSimpleResponse, createErrorResponse } from "../responses/index.js";
import { execSync } from "child_process";
import { z } from "zod";

const runTestsSchema = {
    projectDir: z.string().describe("Project directory"),
    keepBrowser: z.boolean().describe("Save browser after run").optional(),
};

const runTestsCb: ToolCallback<typeof runTestsSchema> = async ({ projectDir, keepBrowser = false }) => {
    try {
        const result = execSync(`cd ${projectDir} && npx testplane ${keepBrowser ? "--keep-browser" : ""}`);

        return createSimpleResponse(`Successfully run tests:\n${result}`);
    } catch (error) {
        console.error("Error run tests:", error);
        return createErrorResponse("Error run tests", error instanceof Error ? error : undefined);
    }
};

export const runTests: ToolDefinition<typeof runTestsSchema> = {
    name: "runTests",
    description: "Run tests",
    schema: runTestsSchema,
    cb: runTestsCb,
};
