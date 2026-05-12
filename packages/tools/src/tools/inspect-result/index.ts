import { readResultsFromReport, type ReporterTestResult } from "html-reporter/experimental/sdk";
import { createErrorResponse, createSimpleResponse } from "../../responses/index.js";
import { StandaloneTool, ToolKind } from "../../types.js";
import { downloadReportIfNeeded } from "../../utils/html-report.js";
import { toTestResultView } from "../../utils/test-result-view.js";
import { inspectResultSchema } from "./schema.js";

export { inspectResultSchema } from "./schema.js";

function getLatestAttempt<T extends ReporterTestResult>(results: readonly T[]): T {
    return results.reduce((latest, result) => {
        if (
            result.attempt > latest.attempt ||
            (result.attempt === latest.attempt && (result.timestamp ?? 0) >= (latest.timestamp ?? 0))
        ) {
            return result;
        }

        return latest;
    });
}

function getInspectResultSelectionError(
    results: readonly ReporterTestResult[],
    args: { name: string; browser: string; attempt?: number },
): string {
    const resultsWithMatchingName = results.filter(result => result.fullName === args.name);

    if (!resultsWithMatchingName.length) {
        return `No test result found with name "${args.name}". You can check what tests are available with the "test-results" tool.`;
    }

    const resultsWithMatchingBrowser = resultsWithMatchingName.filter(result => result.browserId === args.browser);
    if (!resultsWithMatchingBrowser.length) {
        const availableBrowsers = [...new Set(resultsWithMatchingName.map(result => result.browserId))].sort();

        return `No test result found with name "${args.name}" in browser "${args.browser}". Available browsers: ${availableBrowsers.join(", ")}.`;
    }

    const availableAttempts = [...new Set(results.map(result => result.attempt))].sort();

    return `No attempt ${args.attempt} found for test "${args.name}" in browser "${args.browser}". Available attempts: ${availableAttempts.join(", ")}.`;
}

function findTestResult(
    results: readonly ReporterTestResult[],
    args: { name: string; browser: string; attempt?: number },
): ReporterTestResult {
    const matchingAttempts = results.filter(
        result => result.fullName === args.name && result.browserId === args.browser,
    );
    if (args.attempt === undefined) {
        return getLatestAttempt(matchingAttempts);
    }

    const matchingAttempt = matchingAttempts.find(result => result.attempt === args.attempt);

    if (!matchingAttempt) {
        throw new Error(getInspectResultSelectionError(results, args));
    }

    return matchingAttempt;
}

const inspectResultCb: StandaloneTool<typeof inspectResultSchema>["cb"] = async args => {
    try {
        const reportPath = await downloadReportIfNeeded(args.report);
        const results = await readResultsFromReport(reportPath);
        const result = findTestResult(results, args);
        const view = toTestResultView(result, undefined, { includeBase64: args.includeBase64 });

        return createSimpleResponse(JSON.stringify(view, null, args.pretty ? 2 : undefined));
    } catch (error) {
        console.error("Error inspecting test result from report:", error);

        return createErrorResponse(
            "Error inspecting test result from report",
            error instanceof Error ? error : undefined,
        );
    }
};

export const inspectResult: StandaloneTool<typeof inspectResultSchema> = {
    kind: ToolKind.Standalone,
    name: "inspect-result",
    description: "Read a Testplane HTML report and inspect one test result attempt as JSON",
    schema: inspectResultSchema,
    cb: inspectResultCb,
    cli: {
        positional: ["report"],
        section: "Reports",
        examples: [
            'testplane-cli inspect-result /path/to/html-report --name "checkout submits order" --browser chrome',
            'testplane-cli inspect-result /path/to/html-report --name "checkout submits order" --browser chrome --attempt 0',
            'testplane-cli inspect-result /path/to/html-report --name "checkout submits order" --browser chrome --no-pretty',
        ],
    },
};
