import { readResultsFromReport, type ReporterTestResult } from "html-reporter/experimental/sdk";
import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { StandaloneTool, ToolKind } from "../../types.js";
import { createErrorResponse, createSimpleResponse } from "../../responses/index.js";
import { downloadReportIfNeeded } from "../../utils/html-report.js";
import { formatDuration, formatFileSize, formatTimestamp } from "../../utils/formatters.js";
import { stringify } from "../../utils/strings.js";
import { toTestResultView } from "../../utils/test-result-view.js";
import { filterTestResults, getResultStatusTags } from "./filters.js";
import { testResultsSchema } from "./schema.js";
import {
    TEST_RESULT_STATUSES,
    type SavedTestResultsJsonReport,
    type StatusCounts,
    type TestResultField,
    type FilterOptions,
    type PaginationOptions,
    type TestResultsCounts,
    type TestResultView,
} from "./types.js";

export { testResultsSchema } from "./schema.js";

const SAVED_JSON_DIR = path.join(os.tmpdir(), "testplane-cli");

export function getFinalTestResults<T extends ReporterTestResult>(results: readonly T[]): T[] {
    const finalTestResults = new Map<string, T>();

    for (const result of results) {
        const key = `${result.fullName}.${result.browserId}`;
        const current = finalTestResults.get(key);

        if (
            !current ||
            result.attempt > current.attempt ||
            (result.attempt === current.attempt && (result.timestamp ?? 0) >= (current.timestamp ?? 0))
        ) {
            finalTestResults.set(key, result);
        }
    }

    return [...finalTestResults.values()];
}

function getStatusCounts(results: readonly ReporterTestResult[]): StatusCounts {
    const statusCounts = Object.fromEntries(TEST_RESULT_STATUSES.map(status => [status, 0])) as StatusCounts;

    for (const result of results) {
        const tags = getResultStatusTags(result);

        for (const status of TEST_RESULT_STATUSES) {
            if (tags.includes(status)) {
                statusCounts[status] += 1;
            }
        }
    }

    return statusCounts;
}

function formatStatusCounts(statusCounts: StatusCounts): string {
    return TEST_RESULT_STATUSES.map(status => [status, statusCounts[status]] as const)
        .map(([status, count]) => `${status}: ${count}`)
        .join(", ");
}

function formatActiveFilters(filters: FilterOptions): string | null {
    const activeFilters = [
        filters.grep ? `grep=${filters.grep.source}` : null,
        filters.status.length ? `status=${filters.status.join(",")}` : null,
        filters.browser.length ? `browser=${filters.browser.join(",")}` : null,
        filters.duration ? `duration=${filters.duration.source}` : null,
        filters.grepError ? `grep-error=${filters.grepError.source}` : null,
        filters.meta.length ? `meta=${filters.meta.map(filter => filter.source).join(",")}` : null,
        filters.file.length ? `file=${filters.file.map(file => file.source).join(",")}` : null,
    ].filter((filter): filter is string => filter !== null);

    return activeFilters.length ? activeFilters.join("; ") : null;
}

function formatTestResultField(result: TestResultView, field: TestResultField): string | null {
    switch (field) {
        case "skipOrMuteReason":
            return result.skipOrMuteReason ? `mute/skip reason: ${result.skipOrMuteReason}` : null;
        case "status":
            return result.status ?? null;
        case "browser":
            return result.browser ?? null;
        case "attempt":
            return result.attempt === undefined
                ? null
                : result.attempt > 0
                  ? `attempt ${result.attempt} (retried)`
                  : `attempt ${result.attempt}`;
        case "duration":
            return formatDuration(result.duration);
        case "file":
            return result.file ?? "unknown file";
        case "meta":
            return result.meta === undefined || result.meta === null ? null : stringify(result.meta);
        case "name":
        case "error":
            return null;
    }
}

function formatTestResult(result: TestResultView, index: number, fields: readonly TestResultField[]): string {
    const details = fields
        .map(field => formatTestResultField(result, field))
        .filter(Boolean)
        .join(" | ");
    const title = fields.includes("name") ? (result.name ?? null) : null;
    const errorLine = fields.includes("error") && typeof result.error === "string" ? result.error : null;
    const firstLine = details || title || errorLine || "(no output fields)";

    return [`${index}. ${firstLine}`, details && title ? `   ${title}` : null, errorLine ? `   ${errorLine}` : null]
        .filter(Boolean)
        .join("\n");
}

export function getTestResultsCounts(
    totalAttempts: number,
    finalResults: readonly ReporterTestResult[],
    matchedResults: readonly ReporterTestResult[],
): TestResultsCounts {
    return {
        totalAttempts,
        totalTests: finalResults.length,
        matchedTests: matchedResults.length,
        testsByStatus: getStatusCounts(finalResults),
        matchedTestsByStatus: getStatusCounts(matchedResults),
    };
}

export function formatTestResultsReport(
    counts: TestResultsCounts,
    filters: FilterOptions,
    fields: readonly TestResultField[],
    results: readonly TestResultView[],
    pagination: PaginationOptions,
): string {
    const sections: string[] = [
        `Total tests: ${counts.totalTests}; total attempts: ${counts.totalAttempts}; matched tests: ${counts.matchedTests}`,
        `Total tests counts: ${formatStatusCounts(counts.testsByStatus)}`,
        `Matched tests counts: ${formatStatusCounts(counts.matchedTestsByStatus)}`,
    ];

    const activeFilters = formatActiveFilters(filters);
    if (activeFilters) {
        sections.push(`Filters: ${activeFilters}`);
    }

    if (!results.length) {
        sections.push("No test results matched filters.");

        return sections.join("\n");
    }

    const start = Math.min(pagination.offset, results.length);
    const end = Math.min(start + pagination.limit, results.length);
    const page = results.slice(start, end);

    if (!page.length) {
        sections.push(
            `No test results to show at offset ${pagination.offset}. Matched test results: ${results.length}.`,
        );

        return sections.join("\n\n");
    }

    sections.push(
        `Showing ${start + 1}-${end} of ${results.length} matched test results (offset ${pagination.offset}, limit ${pagination.limit}).`,
    );
    sections.push(page.map((result, index) => formatTestResult(result, start + index + 1, fields)).join("\n"));

    if (end < results.length) {
        sections.push(`More test results are available. Continue with offset ${end} and limit ${pagination.limit}.`);
    }

    return sections.join("\n\n");
}

export async function saveTestResultsJsonReport(
    reportPath: string,
    counts: TestResultsCounts,
    fields: readonly TestResultField[],
    results: readonly TestResultView[],
): Promise<SavedTestResultsJsonReport> {
    const data = {
        report: reportPath,
        totalTests: counts.totalTests,
        totalAttempts: counts.totalAttempts,
        matchedTests: counts.matchedTests,
        fields: [...fields],
        totalTestCounts: counts.testsByStatus,
        matchedTestCounts: counts.matchedTestsByStatus,
        results: [...results],
    };
    const timestamp = formatTimestamp();
    const filePath = path.join(SAVED_JSON_DIR, `test-results-${timestamp}-${randomUUID()}.json`);
    const jsonExample = JSON.stringify(
        {
            ...data,
            results: data.results.slice(0, 1),
        },
        null,
        2,
    );

    await mkdir(SAVED_JSON_DIR, { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");

    return {
        filePath,
        fileSizeBytes: (await stat(filePath)).size,
        jsonExample,
    };
}

const testResultsCb: StandaloneTool<typeof testResultsSchema>["cb"] = async args => {
    try {
        const reportPath = await downloadReportIfNeeded(args.report);
        const results = await readResultsFromReport(reportPath);

        const finalResults = getFinalTestResults(results);
        const matchedResults = filterTestResults(finalResults, args);

        const counts = getTestResultsCounts(results.length, finalResults, matchedResults);
        const resultViews = matchedResults.map(result =>
            toTestResultView(result, args.fields, { errorFormat: "line" }),
        );

        if (args.saveJson) {
            const savedReport = await saveTestResultsJsonReport(args.report, counts, args.fields, resultViews);

            return createSimpleResponse(
                `Saved test results JSON: ${savedReport.filePath}\n` +
                    `Tests saved: ${counts.matchedTests} matched final tests (${counts.totalTests} total final tests, ${counts.totalAttempts} total attempts).\n` +
                    `File size: ${formatFileSize(savedReport.fileSizeBytes)} (${savedReport.fileSizeBytes} bytes).\n` +
                    `Fields: ${args.fields.join(", ")}\n\n` +
                    `Each result object contains exactly the selected fields.\n\n` +
                    `JSON file example fragment:\n\`\`\`json\n${savedReport.jsonExample}\n\`\`\``,
            );
        }

        return createSimpleResponse(
            `Test results in report: ${args.report}\n` +
                formatTestResultsReport(counts, args, args.fields, resultViews, {
                    limit: args.limit,
                    offset: args.offset,
                }),
        );
    } catch (error) {
        console.error("Error reading test results from report:", error);

        return createErrorResponse(
            "Error reading test results from report",
            error instanceof Error ? error : undefined,
        );
    }
};

export const testResults: StandaloneTool<typeof testResultsSchema> = {
    kind: ToolKind.Standalone,
    name: "test-results",
    description: "Read a Testplane HTML report and list final-attempt test results with filters",
    schema: testResultsSchema,
    cb: testResultsCb,
    cli: {
        positional: ["report"],
        section: "Reports",
        examples: [
            "testplane-cli test-results /path/to/html-report --status failed,muted",
            "testplane-cli test-results https://example.com/report --grep 'checkout' --browser chrome --duration '>5s'",
            "testplane-cli test-results /path/to/html-report --meta owner=qa --file 'src/**'",
            "testplane-cli test-results /path/to/html-report --fields name,status,browser,error",
            "testplane-cli test-results /path/to/html-report --status failed --save-json",
        ],
    },
};
