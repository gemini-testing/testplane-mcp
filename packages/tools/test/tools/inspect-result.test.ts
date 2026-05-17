import { fileURLToPath } from "node:url";
import type { ReporterTestResult } from "html-reporter/experimental/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { inspectResult } from "../../src/tools/inspect-result/index.js";
import { inspectResultObjectSchema } from "../../src/tools/inspect-result/schema.js";
import { toTestResultView } from "../../src/utils/test-result-view.js";

const SAMPLE_REPORT = fileURLToPath(new URL("../fixtures/sample-html-report", import.meta.url));

type InspectResultInput = z.input<typeof inspectResultObjectSchema>;

function getTextContent(result: { content: unknown }): string {
    const content = result.content as Array<{ text: string }>;

    return content.map(item => item.text).join("\n");
}

function parseInspectResultArgs(args: Partial<InspectResultInput> = {}) {
    return inspectResultObjectSchema.parse({
        report: SAMPLE_REPORT,
        name: "failed describe test with image comparison diff",
        browser: "chrome",
        ...args,
    });
}

describe("tools/inspect-result", () => {
    it("prints detailed JSON for all selected test result attempts by default", async () => {
        const result = await inspectResult.cb(parseInspectResultArgs());
        const text = getTextContent(result);
        const details = JSON.parse(text);

        expect(result.isError).toBeFalsy();
        expect(text).toContain('\n    "status": "fail"');
        expect(details).toHaveLength(2);
        expect(details.map((attempt: { attempt: number }) => attempt.attempt)).toEqual([0, 1]);
        expect(details[1]).toMatchObject({
            name: "failed describe test with image comparison diff",
            status: "fail",
            browser: "chrome",
            attempt: 1,
            file: "failed-describe.testplane.js",
            error: {
                name: "AssertViewError",
                message: "image comparison failed",
            },
        });
        expect(details[1].error.stack).toContain("TestRunner.finishRun");
        expect(details[1].steps[0]).toMatchObject({
            name: "setWindowSize",
            args: ["1280", "1024"],
        });
        expect(details[1].images[0]).toMatchObject({
            status: "fail",
            stateName: "header",
            differentPixels: 25730,
        });
        expect(details[1].attachments.map((attachment: { type: string }) => attachment.type)).toEqual([
            "tags",
            "snapshot",
            "badges",
        ]);
        expect(details[1]).not.toHaveProperty("history");
        expect(details[1]).not.toHaveProperty("imagesInfo");
    });

    it("prints compact JSON and honors an explicit attempt", async () => {
        const result = await inspectResult.cb(parseInspectResultArgs({ attempt: 0, pretty: false }));
        const text = getTextContent(result);
        const details = JSON.parse(text);

        expect(result.isError).toBeFalsy();
        expect(text).not.toContain("\n");
        expect(details).toMatchObject({
            name: "failed describe test with image comparison diff",
            browser: "chrome",
            attempt: 0,
            status: "fail",
        });
    });

    it("omits base64 payloads and strips ANSI control characters from detailed result views", () => {
        const reporterResult = {
            fullName: "test",
            browserId: "chrome",
            attempt: 0,
            status: "error",
            duration: 1,
            file: "testplane.js",
            error: {
                name: "Error",
                message: "\u001B[31mWith screenshot\u001B[39m",
                stack: "Error: \u001B[31mWith screenshot\u001B[39m",
                screenshot: {
                    base64: "secret-error-base64",
                    size: { width: 1, height: 1 },
                },
            },
            errorDetails: {
                title: "\u001B[31mDetails\u001B[39m",
                filePath: "details.json",
            },
            history: [],
            id: "id",
            imageDir: "images/test",
            imagesInfo: [
                {
                    status: "error",
                    error: {
                        message: "\u001B[31mImage error\u001B[39m",
                    },
                    actualImg: {
                        base64: "secret-image-base64",
                        size: { width: 1, height: 1 },
                    },
                },
            ],
            meta: {},
            sessionId: "session-id",
            skipReason: undefined,
            timestamp: 1,
            url: "https://example.com",
            description: undefined,
            attachments: [],
        } as unknown as ReporterTestResult;

        const withoutBase64 = JSON.stringify(toTestResultView(reporterResult, []));
        const withBase64 = JSON.stringify(toTestResultView(reporterResult, [], { includeBase64: true }));

        expect(withoutBase64).not.toContain("secret-error-base64");
        expect(withoutBase64).not.toContain("secret-image-base64");
        expect(withoutBase64).not.toContain("\u001B");
        expect(withoutBase64).toContain("With screenshot");
        expect(withoutBase64).toContain("Image error");
        expect(withoutBase64).toContain("base64Omitted");
        expect(withBase64).toContain("secret-error-base64");
        expect(withBase64).toContain("secret-image-base64");
        expect(withBase64).not.toContain("\u001B");
    });
});
