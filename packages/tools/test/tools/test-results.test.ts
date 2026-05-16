import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readResultsFromReport, type ReporterTestResult } from "html-reporter/experimental/sdk";
import { describe, expect, it, beforeAll } from "vitest";
import { z } from "zod";

import { testResults, getFinalTestResults, toTestResultView } from "../../src/tools/test-results/index.js";
import { testResultsObjectSchema } from "../../src/tools/test-results/schema.js";

const SAMPLE_REPORT = fileURLToPath(new URL("../fixtures/sample-html-report", import.meta.url));
const EXPECTED_COUNTS_LINE = "Total tests: 9; total attempts: 17; matched tests:";
const EXPECTED_STATUS_COUNTS = "passed: 3, failed: 5, muted: 0, retried: 8, skipped: 1";

type TestResultsInput = z.input<typeof testResultsObjectSchema>;

function getTextContent(result: { content: unknown }): string {
    const content = result.content as Array<{ text: string }>;

    return content.map(item => item.text).join("\n");
}

function parseArgs(args: Partial<TestResultsInput> = {}) {
    return testResultsObjectSchema.parse({
        report: SAMPLE_REPORT,
        ...args,
    });
}

function extractSavedJsonPath(responseText: string): string {
    const match = responseText.match(/Saved test results JSON: (.+\.json)/);

    if (!match) {
        throw new Error(`No saved JSON path found in response:\n${responseText}`);
    }

    return match[1];
}

describe("tools/test-results", () => {
    let reportResults: Awaited<ReturnType<typeof readResultsFromReport>>;

    beforeAll(async () => {
        reportResults = await readResultsFromReport(SAMPLE_REPORT);
    });

    it("keeps only final attempts from the sample report", () => {
        const finalResults = getFinalTestResults(reportResults);

        expect(reportResults).toHaveLength(17);
        expect(finalResults).toHaveLength(9);
        expect(finalResults.map(result => [result.fullName, result.attempt, result.status])).toEqual([
            ["failed describe test skipped", 0, "skipped"],
            ["failed describe successfully passed test", 1, "success"],
            ["failed describe test without screenshot", 1, "fail"],
            ["failed describe test with image comparison diff", 1, "fail"],
            ["failed describe test with long error message", 1, "error"],
            ["failed describe test with successful assertView and error", 1, "error"],
            ["failed describe failed test with ansi markup", 1, "error"],
            ["success describe successfully passed test", 1, "success"],
            ["success describe test with screenshot", 1, "success"],
        ]);
    });

    it("prints a paginated summary for the sample report", async () => {
        const result = await testResults.cb(parseArgs({ limit: 3 }));
        const text = getTextContent(result);

        expect(result.isError).toBeFalsy();
        expect(text).toContain(`Test results in report: ${SAMPLE_REPORT}`);
        expect(text).toContain(`${EXPECTED_COUNTS_LINE} 9`);
        expect(text).toContain(`Total tests counts: ${EXPECTED_STATUS_COUNTS}`);
        expect(text).toContain(`Matched tests counts: ${EXPECTED_STATUS_COUNTS}`);
        expect(text).toContain("Showing 1-3 of 9 matched test results (offset 0, limit 3).");
        expect(text).toContain("More test results are available. Continue with offset 3 and limit 3.");
        expect(text).toContain("failed describe test skipped");
        expect(text).toContain("failed describe successfully passed test");
        expect(text).toContain("failed describe test without screenshot");
    });

    it("filters by failed status and renders selected fields", async () => {
        const result = await testResults.cb(
            parseArgs({
                status: "failed",
                fields: "name,status,error",
                limit: 10,
            }),
        );
        const text = getTextContent(result);

        expect(result.isError).toBeFalsy();
        expect(text).toContain(`${EXPECTED_COUNTS_LINE} 5`);
        expect(text).toContain("Filters: status=failed");
        expect(text).toContain("Matched tests counts: passed: 0, failed: 5, muted: 0, retried: 5, skipped: 0");
        expect(text).toContain("failed describe test without screenshot");
        expect(text).toContain("AssertViewError: image comparison failed");
        expect(text).toContain("failed describe test with successful assertView and error");
        expect(text).toContain("Error: Some error");
        expect(text).not.toContain("success describe test with screenshot");
    });

    it("combines name, browser, duration, error, meta and file filters", async () => {
        const result = await testResults.cb(
            parseArgs({
                grep: "long error|successful assertView",
                browser: "chrome",
                duration: ">280ms",
                grepError: "long_error_message|Some error",
                meta: ["file=failed-describe.testplane.js"],
                file: "failed-*.testplane.js",
                fields: "name,status,duration,file,error",
                limit: 10,
            }),
        );
        const text = getTextContent(result);

        expect(result.isError).toBeFalsy();
        expect(text).toContain(`${EXPECTED_COUNTS_LINE} 2`);
        expect(text).toContain(
            "Filters: grep=long error|successful assertView; browser=chrome; duration=>280ms; grep-error=long_error_message|Some error; meta=file=failed-describe.testplane.js; file=failed-*.testplane.js",
        );
        expect(text).toContain("failed describe test with long error message");
        expect(text).toContain("failed describe test with successful assertView and error");
        expect(text).not.toContain("failed describe test with image comparison diff");
    });

    it("filters skipped tests and exposes skip reason when requested", async () => {
        const result = await testResults.cb(
            parseArgs({
                status: "skipped",
                fields: "name,status,skipOrMuteReason",
            }),
        );
        const text = getTextContent(result);

        expect(result.isError).toBeFalsy();
        expect(text).toContain(`${EXPECTED_COUNTS_LINE} 1`);
        expect(text).toContain("failed describe test skipped");
        expect(text).toContain("mute/skip reason: Skipped by mocha interface");
    });

    it("uses null for requested view fields without source values", () => {
        const result = {
            fullName: "suite test",
            status: "success",
            browserId: "chrome",
            attempt: 0,
        } as ReporterTestResult;

        expect(toTestResultView(result, ["duration", "file", "error", "meta", "skipOrMuteReason"])).toEqual({
            duration: null,
            file: null,
            error: null,
            meta: null,
            skipOrMuteReason: null,
        });
    });

    it("saves the whole filtered report as prepared JSON with selected fields", async () => {
        const result = await testResults.cb(
            parseArgs({
                saveJson: true,
                status: "failed",
                fields: "name,status,browser,error",
                limit: 1,
            }),
        );
        const text = getTextContent(result);
        const filePath = extractSavedJsonPath(text);

        try {
            expect(result.isError).toBeFalsy();
            expect(filePath).toContain(path.join(os.tmpdir(), "testplane-cli"));
            expect(text).toContain("Tests saved: 5 matched final tests (9 total final tests, 17 total attempts).");
            expect(text).toContain("Fields: name, status, browser, error");
            expect(text).toContain("JSON file example fragment:");

            const savedReport = JSON.parse(await readFile(filePath, "utf8"));

            expect(savedReport).toMatchObject({
                report: SAMPLE_REPORT,
                totalTests: 9,
                totalAttempts: 17,
                matchedTests: 5,
                fields: ["name", "status", "browser", "error"],
                matchedTestCounts: {
                    passed: 0,
                    failed: 5,
                    muted: 0,
                    retried: 5,
                    skipped: 0,
                },
            });
            expect(savedReport.results).toHaveLength(5);
            expect(Object.keys(savedReport.results[0])).toEqual(["name", "status", "browser", "error"]);
            expect(savedReport.results[0]).toEqual({
                name: "failed describe test without screenshot",
                status: "fail",
                browser: "chrome",
                error: "AssertViewError: image comparison failed",
            });
            expect(savedReport.results[0]).not.toHaveProperty("fullName");
            expect(savedReport.results[0]).not.toHaveProperty("imagesInfo");
        } finally {
            await rm(filePath, { force: true });
        }
    });

    it("validates filters and fields through the tool schema", () => {
        expect(testResultsObjectSchema.safeParse({ report: SAMPLE_REPORT, status: "fail" })).toMatchObject({
            success: false,
        });
        expect(testResultsObjectSchema.safeParse({ report: SAMPLE_REPORT, duration: "slow" })).toMatchObject({
            success: false,
        });
        expect(testResultsObjectSchema.safeParse({ report: SAMPLE_REPORT, grep: "[" })).toMatchObject({
            success: false,
        });
        expect(testResultsObjectSchema.safeParse({ report: SAMPLE_REPORT, fields: "name,nope" })).toMatchObject({
            success: false,
        });
        expect(testResultsObjectSchema.safeParse({ report: SAMPLE_REPORT, meta: ["=qa"] })).toMatchObject({
            success: false,
        });
    });
});
