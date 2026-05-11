import type { ReporterTestResult } from "html-reporter/experimental/sdk";

export const TEST_RESULT_STATUSES = ["passed", "failed", "muted", "retried", "skipped"] as const;
export const TEST_RESULT_FIELDS = [
    "status",
    "browser",
    "attempt",
    "duration",
    "file",
    "name",
    "error",
    "meta",
    "skipOrMuteReason",
] as const;
export const DEFAULT_TEST_RESULT_FIELDS = [
    "status",
    "browser",
    "attempt",
    "duration",
    "file",
    "name",
    "error",
] as const;

export type ReporterImageInfo = NonNullable<ReporterTestResult["imagesInfo"]>[number];
export type TestResultStatus = (typeof TEST_RESULT_STATUSES)[number];
export type TestResultField = (typeof TEST_RESULT_FIELDS)[number];
export type StatusCounts = Record<TestResultStatus, number>;

export interface RegexFilter {
    source: string;
    regex: RegExp;
}

export interface DurationFilter {
    source: string;
    operator: ">" | ">=" | "<" | "<=" | "=";
    durationMs: number;
}

export interface MetaFilter {
    source: string;
    key: string;
    value: string;
}

export interface FileMaskFilter {
    source: string;
    basenameOnly: boolean;
    regex: RegExp;
}

export interface FilterOptions {
    grep?: RegexFilter;
    status: TestResultStatus[];
    browser: string[];
    duration?: DurationFilter;
    grepError?: RegexFilter;
    meta: MetaFilter[];
    file: FileMaskFilter[];
}

export interface PaginationOptions {
    limit: number;
    offset: number;
}

export interface TestResultView {
    status?: string;
    browser?: string;
    attempt?: number;
    duration?: number | null;
    file?: string | null;
    name?: string;
    error?: string | null;
    meta?: unknown;
    skipOrMuteReason?: string | null;
}

export interface TestResultsCounts {
    totalTests: number;
    totalAttempts: number;
    matchedTests: number;
    testsByStatus: StatusCounts;
    matchedTestsByStatus: StatusCounts;
}

export interface TestResultsJsonReport {
    report: string;
    totalTests: number;
    totalAttempts: number;
    matchedTests: number;
    fields: TestResultField[];
    totalTestCounts: StatusCounts;
    matchedTestCounts: StatusCounts;
    results: TestResultView[];
}

export interface SavedTestResultsJsonReport {
    filePath: string;
    fileSizeBytes: number;
    jsonExample: string;
}
