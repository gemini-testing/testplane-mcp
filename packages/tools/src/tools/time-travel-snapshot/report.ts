import path from "node:path";
import { stat } from "node:fs/promises";
import type { ReporterTestResult } from "html-reporter/experimental/sdk";
import { isRemoteSource } from "./rrweb-snapshots.js";
import { ReporterTestStep } from "./types.js";

interface SnapshotAttachment {
    type: 0 | "snapshot";
    path: string;
    maxWidth?: number;
    maxHeight?: number;
}

export interface ReportResultSelection {
    name: string;
    browser: string;
    attempt?: number;
}

export interface ReportDefaultTime {
    absoluteTime: number;
    reason: string;
}

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

function getSelectionError(results: readonly ReporterTestResult[], args: ReportResultSelection): string {
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

export function findReportTestResult(
    results: readonly ReporterTestResult[],
    args: ReportResultSelection,
): ReporterTestResult {
    const matchingAttempts = results.filter(
        result => result.fullName === args.name && result.browserId === args.browser,
    );

    if (!matchingAttempts.length) {
        throw new Error(getSelectionError(results, args));
    }

    if (args.attempt === undefined) {
        return getLatestAttempt(matchingAttempts);
    }

    const matchingAttempt = matchingAttempts.find(result => result.attempt === args.attempt);
    if (!matchingAttempt) {
        throw new Error(getSelectionError(results, args));
    }

    return matchingAttempt;
}

function isSnapshotAttachment(attachment: unknown): attachment is SnapshotAttachment {
    return (
        typeof attachment === "object" &&
        attachment !== null &&
        "path" in attachment &&
        typeof attachment.path === "string" &&
        "type" in attachment &&
        (attachment.type === 0 || attachment.type === "snapshot")
    );
}

export function getSnapshotAttachment(result: ReporterTestResult): SnapshotAttachment {
    const attachment = result.attachments?.find(candidate => isSnapshotAttachment(candidate));
    if (!isSnapshotAttachment(attachment)) {
        throw new Error(
            `No time travel snapshot attachment found for "${result.fullName}" in browser "${result.browserId}" attempt ${result.attempt}.`,
        );
    }

    return attachment;
}

function isProbablyFileUrl(url: URL): boolean {
    if (url.pathname.endsWith("/")) {
        return false;
    }

    return path.posix.basename(url.pathname).includes(".");
}

function resolveRemoteSnapshotPath(report: string, attachmentPath: string): string {
    if (isRemoteSource(attachmentPath)) {
        return attachmentPath;
    }

    const baseUrl = new URL(report);
    if (!isProbablyFileUrl(baseUrl) && !baseUrl.pathname.endsWith("/")) {
        baseUrl.pathname = `${baseUrl.pathname}/`;
    }

    return new URL(attachmentPath, baseUrl).toString();
}

async function getLocalReportDir(reportPath: string): Promise<string> {
    try {
        const reportStat = await stat(reportPath);

        return reportStat.isDirectory() ? reportPath : path.dirname(reportPath);
    } catch {
        return path.dirname(reportPath);
    }
}

export async function resolveSnapshotAttachmentSource(
    originalReport: string,
    resolvedReportPath: string,
    attachmentPath: string,
): Promise<string> {
    if (isRemoteSource(originalReport)) {
        return resolveRemoteSnapshotPath(originalReport, attachmentPath);
    }

    if (isRemoteSource(attachmentPath)) {
        return attachmentPath;
    }

    const reportDir = await getLocalReportDir(resolvedReportPath);

    return path.resolve(reportDir, attachmentPath);
}

function findFirstFailedStep(steps: readonly ReporterTestStep[] | undefined): ReporterTestStep | null {
    for (const step of steps ?? []) {
        if (step.f) {
            return step;
        }

        const childFailedStep = findFirstFailedStep(step.c);
        if (childFailedStep) {
            return childFailedStep;
        }
    }

    return null;
}

export function getReportDefaultTime(result: ReporterTestResult): ReportDefaultTime | undefined {
    const failedStep = findFirstFailedStep(result.history);
    if (failedStep) {
        return {
            absoluteTime: failedStep.ts + failedStep.d,
            reason: `default failed step "${failedStep.n}" end`,
        };
    }

    if (result.status === "fail" || result.status === "error") {
        return {
            absoluteTime: result.timestamp + result.duration,
            reason: `default ${result.status} result end`,
        };
    }

    return undefined;
}
