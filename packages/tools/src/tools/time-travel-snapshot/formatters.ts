import { ReporterTestResult } from "html-reporter/experimental/sdk";
import { TimeTravelArchive } from "./rrweb-snapshots.js";
import { TimeTravelSnapshotArgs } from "./schema.js";
import { ReporterTestStep, SelectedSnapshotTime, SnapshotInputSelection } from "./types.js";
import { formatTimestamp } from "../../utils/formatters.js";

function formatOffset(offsetMs: number): string {
    return offsetMs >= 0 ? `+${offsetMs}ms` : `${offsetMs}ms`;
}

function formatStepTime(step: ReporterTestStep, snapshotStartTime: number): string {
    const startOffset = Math.round(step.ts - snapshotStartTime);
    const endOffset = Math.round(step.ts + step.d - snapshotStartTime);

    return `${formatOffset(startOffset)}..${formatOffset(endOffset)}`;
}

function formatStepArg(arg: string): string {
    const singleLineArg = arg.replace(/\s+/g, " ").trim();
    const truncatedArg = singleLineArg.length > 60 ? `${singleLineArg.slice(0, 57)}...` : singleLineArg;

    return JSON.stringify(truncatedArg);
}

function formatStepCall(step: ReporterTestStep): string {
    const args = step.a.length > 0 ? `(${step.a.map(formatStepArg).join(", ")})` : "";

    return `${step.n}${args}`;
}

function formatStepLine(step: ReporterTestStep, snapshotStartTime: number, depth: number): string {
    const marker = step.f ? "!" : "-";
    const indent = "  ".repeat(depth);

    return `${indent}${marker} ${formatStepTime(step, snapshotStartTime)} ${formatStepCall(step)}`;
}

function formatStepTree(step: ReporterTestStep, snapshotStartTime: number, depth: number): string[] {
    return [
        formatStepLine(step, snapshotStartTime, depth),
        ...(step.c ?? []).flatMap(child => formatStepTree(child, snapshotStartTime, depth + 1)),
    ];
}

export function formatReportTestSteps(result: ReporterTestResult, snapshotStartTime: number): string | undefined {
    if (!result.history?.length) {
        return undefined;
    }

    const lines = ['Times are offsets from the first rrweb event; use them as "time" values.'];

    for (const step of result.history) {
        if (step.f) {
            lines.push(...formatStepTree(step, snapshotStartTime, 0));
            continue;
        }

        lines.push(formatStepLine(step, snapshotStartTime, 0));
    }

    return lines.join("\n");
}

function formatSelectedTime(selection: SelectedSnapshotTime): string {
    const lines = [
        `Reason: ${selection.reason}`,
        `Absolute timestamp: ${selection.absoluteTime} (${formatTimestamp(selection.absoluteTime)})`,
        `Offset from first rrweb event: ${selection.offsetMs}ms`,
    ];

    if (selection.requestedTime !== undefined) {
        lines.push(`Requested time: ${selection.requestedTime} (${selection.requestedKind})`);
    }

    if (selection.wasClamped && selection.unclampedTime !== undefined) {
        lines.push(`Unclamped timestamp: ${selection.unclampedTime} (${formatTimestamp(selection.unclampedTime)})`);
    }

    return lines.join("\n");
}

function formatSourceInfo(
    args: TimeTravelSnapshotArgs,
    input: SnapshotInputSelection,
    archive: TimeTravelArchive,
): string {
    const lines = [
        `Mode: ${input.mode}`,
        `Snapshot source: ${archive.source}`,
        `Events: ${archive.events.length}`,
        `Snapshot range: ${archive.metadata.startTime} (${formatTimestamp(archive.metadata.startTime)}) - ${archive.metadata.endTime} (${formatTimestamp(archive.metadata.endTime)}); total ${archive.metadata.totalTime}ms`,
    ];

    if (input.result) {
        lines.unshift(
            `Report: ${args.report}`,
            `Test: ${input.result.fullName}`,
            `Browser: ${input.result.browserId}`,
            `Attempt: ${input.result.attempt}`,
        );
    }

    return lines.join("\n");
}

export function formatResponse(
    args: TimeTravelSnapshotArgs,
    input: SnapshotInputSelection,
    archive: TimeTravelArchive,
    selectedTime: SelectedSnapshotTime,
    diffFromTime: SelectedSnapshotTime | undefined,
    snapshotOutput: string,
): string {
    const sections = [
        "Time travel snapshot captured",
        "## Source",
        formatSourceInfo(args, input, archive),
        "## Selected Time",
        formatSelectedTime(selectedTime),
    ];

    if (diffFromTime) {
        sections.push("## Diff From", formatSelectedTime(diffFromTime));
    }

    if (input.result) {
        const testSteps = formatReportTestSteps(input.result, archive.metadata.startTime);
        if (testSteps) {
            sections.push("## Test Steps", testSteps);
        }
    }

    sections.push(diffFromTime ? "## Snapshot Diff" : "## Snapshot", snapshotOutput);

    return sections.join("\n\n");
}
