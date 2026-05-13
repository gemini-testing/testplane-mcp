import { ReporterTestResult } from "html-reporter/experimental/sdk";

export interface SnapshotInputSelection {
    mode: "report" | "direct";
    source: string;
    result?: ReporterTestResult;
    defaultTime?: {
        absoluteTime: number;
        reason: string;
    };
}

export type ReporterTestStep = NonNullable<ReporterTestResult["history"]>[number];

export interface SelectedSnapshotTime {
    absoluteTime: number;
    offsetMs: number;
    reason: string;
    requestedTime?: number;
    requestedKind?: "offset" | "timestamp" | "default";
    unclampedTime?: number;
    wasClamped: boolean;
}
