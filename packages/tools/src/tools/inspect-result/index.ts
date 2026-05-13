import { readResultsFromReport, type ReporterTestResult } from "html-reporter/experimental/sdk";
import { createErrorResponse, createSimpleResponse } from "../../responses/index.js";
import { StandaloneTool, ToolKind } from "../../types.js";
import { downloadReportIfNeeded } from "../../utils/html-report.js";
import { toTestResultView } from "../../utils/test-result-view.js";
import { inspectResultSchema } from "./schema.js";

export { inspectResultSchema } from "./schema.js";

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

    const availableAttempts = [...new Set(resultsWithMatchingBrowser.map(result => result.attempt))].sort();

    return `No attempt ${args.attempt} found for test "${args.name}" in browser "${args.browser}". Available attempts: ${availableAttempts.join(", ")}.`;
}

function sortAttempts<T extends ReporterTestResult>(results: readonly T[]): T[] {
    return [...results].sort((left, right) => {
        if (left.attempt !== right.attempt) {
            return left.attempt - right.attempt;
        }

        return (left.timestamp ?? 0) - (right.timestamp ?? 0);
    });
}

function findTestResults(
    results: readonly ReporterTestResult[],
    args: { name: string; browser: string; attempt?: number },
): ReporterTestResult[] {
    const matchingAttempts = results.filter(
        result => result.fullName === args.name && result.browserId === args.browser,
    );

    if (!matchingAttempts.length) {
        throw new Error(getInspectResultSelectionError(results, args));
    }

    if (args.attempt === undefined) {
        return sortAttempts(matchingAttempts);
    }

    const matchingAttempt = matchingAttempts.find(result => result.attempt === args.attempt);

    if (!matchingAttempt) {
        throw new Error(getInspectResultSelectionError(results, args));
    }

    return [matchingAttempt];
}

const inspectResultCb: StandaloneTool<typeof inspectResultSchema>["cb"] = async args => {
    try {
        const reportPath = await downloadReportIfNeeded(args.report);
        const results = await readResultsFromReport(reportPath);
        const selectedResults = findTestResults(results, args);
        const views = selectedResults.map(result =>
            toTestResultView(result, undefined, { includeBase64: args.includeBase64 }),
        );
        const view = args.attempt === undefined ? views : views[0];

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
    description: "Read a Testplane HTML report and inspect test result attempt details as JSON",
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
