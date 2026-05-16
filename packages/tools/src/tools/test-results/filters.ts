import type { ReporterTestResult } from "html-reporter/experimental/sdk";
import path from "node:path";
import { getImageError, getImageStateName, isMutedResult } from "../../utils/html-report.js";
import { stringify } from "../../utils/strings.js";
import type { DurationFilter, FileMaskFilter, FilterOptions, TestResultStatus } from "./types.js";

function matchesDuration(duration: number | undefined, filter: DurationFilter): boolean {
    if (duration === undefined || !Number.isFinite(duration)) {
        return false;
    }

    switch (filter.operator) {
        case ">":
            return duration > filter.durationMs;
        case ">=":
            return duration >= filter.durationMs;
        case "<":
            return duration < filter.durationMs;
        case "<=":
            return duration <= filter.durationMs;
        case "=":
            return duration === filter.durationMs;
    }
}

export function getResultStatusTags(result: ReporterTestResult): string[] {
    const status = result.status;
    const tags: string[] = [status];

    if (status === "success") {
        tags.push("passed");
    }
    if (status === "error" || status.includes("fail")) {
        tags.push("failed");
    }
    if (status === "skipped") {
        tags.push("skipped");
    }
    if (isMutedResult(result)) {
        tags.push("muted");
    }
    if (result.attempt > 0) {
        tags.push("retried");
    }

    return tags;
}

function matchesStatus(result: ReporterTestResult, statuses: readonly TestResultStatus[]): boolean {
    if (!statuses.length) {
        return true;
    }

    const tags = getResultStatusTags(result);

    return statuses.some(status => tags.includes(status));
}

function getErrorText(result: ReporterTestResult): string {
    const parts: string[] = [];

    if (result.error?.name) parts.push(result.error.name);
    if (result.error?.message) parts.push(result.error.message);
    if (result.error?.stack) parts.push(result.error.stack);

    for (const imageInfo of result.imagesInfo ?? []) {
        const stateName = getImageStateName(imageInfo);
        const error = getImageError(imageInfo);

        if (stateName) parts.push(stateName);
        if (error?.name) parts.push(error.name);
        if (error?.message) parts.push(error.message);
        if (error?.stack) parts.push(error.stack);
    }

    return parts.join("\n");
}

function matchesFile(result: ReporterTestResult, fileMasks: readonly FileMaskFilter[]): boolean {
    if (!fileMasks.length) {
        return true;
    }

    const file = (result.file ?? "").replace(/\\/g, "/");
    const basename = path.posix.basename(file);

    return fileMasks.some(mask => mask.regex.test(mask.basenameOnly ? basename : file));
}

export function filterTestResults(
    results: readonly ReporterTestResult[],
    filters: FilterOptions,
): ReporterTestResult[] {
    return results.filter(result => {
        return (
            (!filters.grep || filters.grep.regex.test(result.fullName)) &&
            matchesStatus(result, filters.status) &&
            (!filters.browser.length || filters.browser.includes(result.browserId)) &&
            (!filters.duration || matchesDuration(result.duration, filters.duration)) &&
            (!filters.grepError || filters.grepError.regex.test(getErrorText(result))) &&
            filters.meta.every(filter => stringify(result.meta?.[filter.key]) === filter.value) &&
            matchesFile(result, filters.file)
        );
    });
}
