import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import type { eventWithTime as RrwebEvent } from "@rrweb/types";
import { SelectedSnapshotTime } from "./types.js";

export type NumberedRrwebEvent = RrwebEvent & { seqNo: number };

export interface TimeTravelArchive {
    source: string;
    events: NumberedRrwebEvent[];
    metadata: RrwebSnapshotMetadata;
}

export interface RrwebSnapshotMetadata {
    startTime: number;
    endTime: number;
    totalTime: number;
    width?: number;
    height?: number;
}

export interface ResolveTargetTimeOptions {
    time?: number;
    defaultAbsoluteTime?: number;
    defaultReason?: string;
}

const SNAPSHOTS_FILE_NAME = "snapshots.json";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRemoteSource(source: string): boolean {
    try {
        const url = new URL(source);

        return Boolean(url.host && url.protocol !== "file:");
    } catch {
        return false;
    }
}

function sourceToLocalPath(source: string): string {
    try {
        const url = new URL(source);

        if (url.protocol === "file:") {
            return fileURLToPath(url);
        }
    } catch {
        // Not a URL, treat it as a local path.
    }

    return source;
}

async function readTimeTravelZip(source: string): Promise<Uint8Array> {
    if (isRemoteSource(source)) {
        const response = await fetch(source);
        if (!response.ok) {
            throw new Error(`Failed to fetch snapshot archive "${source}": ${response.status} ${response.statusText}`);
        }

        return new Uint8Array(await response.arrayBuffer());
    }

    return new Uint8Array(await readFile(sourceToLocalPath(source)));
}

function getViewportMetadata(events: readonly NumberedRrwebEvent[]): Pick<RrwebSnapshotMetadata, "width" | "height"> {
    const metaEvent = events.find(event => event.type === 4 && isRecord(event.data));
    const data = isRecord(metaEvent?.data) ? metaEvent.data : undefined;
    const width = typeof data?.width === "number" ? data.width : undefined;
    const height = typeof data?.height === "number" ? data.height : undefined;

    return { width, height };
}

export async function loadTimeTravelArchive(source: string): Promise<TimeTravelArchive> {
    const zipData = await readTimeTravelZip(source);
    const files = unzipSync(zipData);
    const snapshotsFile = files[SNAPSHOTS_FILE_NAME];
    if (!snapshotsFile) {
        throw new Error(`Couldn't find ${SNAPSHOTS_FILE_NAME} in "${source}".`);
    }

    const jsonl = new TextDecoder("utf-8").decode(snapshotsFile);
    const events = jsonl.split("\n").map(line => JSON.parse(line) as NumberedRrwebEvent);

    if (events.length < 2) {
        throw new Error(`Snapshot archive "${source}" is empty (contains less than 2 events).`);
    }

    const startTime = events[0].timestamp;
    const endTime = events[events.length - 1].timestamp;

    return {
        source,
        events,
        metadata: {
            startTime,
            endTime,
            totalTime: endTime - startTime,
            ...getViewportMetadata(events),
        },
    };
}

function clampTime(time: number, metadata: RrwebSnapshotMetadata): number {
    return Math.min(Math.max(time, metadata.startTime), metadata.endTime);
}

export function resolveTargetTime(
    metadata: RrwebSnapshotMetadata,
    { time, defaultAbsoluteTime, defaultReason }: ResolveTargetTimeOptions,
): SelectedSnapshotTime {
    let requestedKind: SelectedSnapshotTime["requestedKind"];
    let requestedTime: number | undefined;
    let unclampedTime: number;
    let reason: string;

    if (time !== undefined) {
        requestedTime = time;
        if (time <= metadata.totalTime) {
            requestedKind = "offset";
            unclampedTime = metadata.startTime + time;
            reason = `provided offset ${time}ms from first rrweb event`;
        } else {
            requestedKind = "timestamp";
            unclampedTime = time;
            reason = `provided absolute timestamp ${time}`;
        }
    } else if (defaultAbsoluteTime !== undefined) {
        requestedKind = "default";
        unclampedTime = defaultAbsoluteTime;
        reason = defaultReason ?? "default time";
    } else {
        requestedKind = "default";
        unclampedTime = metadata.endTime;
        reason = "default snapshot end";
    }

    const absoluteTime = clampTime(unclampedTime, metadata);
    const wasClamped = absoluteTime !== unclampedTime;

    return {
        absoluteTime,
        offsetMs: absoluteTime - metadata.startTime,
        reason: wasClamped ? `${reason}; clamped to available snapshot range` : reason,
        requestedTime,
        requestedKind,
        unclampedTime,
        wasClamped,
    };
}
