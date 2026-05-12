import { Buffer } from "node:buffer";
import { stripVTControlCharacters } from "node:util";
import type { ReporterTestResult } from "html-reporter/experimental/sdk";
import { formatError } from "./formatters.js";
import { getImageError, getImageStateName, isMutedResult } from "./html-report.js";

export const TEST_RESULT_VIEW_FIELDS = [
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
export const DETAILED_TEST_RESULT_FIELDS = [
    ...TEST_RESULT_VIEW_FIELDS,
    "id",
    "description",
    "url",
    "timestamp",
    "sessionId",
    "imageDir",
    "errorDetails",
    "steps",
    "images",
    "attachments",
] as const;

export type ReporterImageInfo = NonNullable<ReporterTestResult["imagesInfo"]>[number];
type ReporterTestError = NonNullable<ReporterTestResult["error"]>;
type ReporterErrorDetails = NonNullable<ReporterTestResult["errorDetails"]>;
type ReporterAttachment = NonNullable<ReporterTestResult["attachments"]>[number];
type ReporterTestStep = NonNullable<ReporterTestResult["history"]>[number];
export type TestResultField = (typeof TEST_RESULT_VIEW_FIELDS)[number];
export type DetailedTestResultField = (typeof DETAILED_TEST_RESULT_FIELDS)[number];

type SanitizedBufferPayload =
    | string
    | {
          bufferOmitted: true;
          byteLength: number;
      };
type SanitizedObject<T extends object> = {
    [K in keyof T as K extends "base64" ? never : K]: SanitizedPayload<T[K]>;
} & (T extends { base64?: string }
    ? {
          base64?: string;
          base64Omitted?: true;
      }
    : Record<never, never>);
type SanitizedPayload<T> = T extends Buffer
    ? SanitizedBufferPayload
    : T extends string
      ? string
      : T extends number | boolean | null | undefined
        ? T
        : T extends readonly (infer Item)[]
          ? SanitizedPayload<Item>[]
          : T extends object
            ? SanitizedObject<T>
            : T;
type SanitizedTestError = SanitizedPayload<ReporterTestError>;
type SanitizedImageInfo = SanitizedPayload<ReporterImageInfo>;
type SanitizedErrorDetails = SanitizedPayload<ReporterErrorDetails>;
type AttachmentView = ReporterAttachment extends infer Attachment
    ? Attachment extends ReporterAttachment
        ? SanitizedPayload<Omit<Attachment, "type">> & { type: string }
        : never
    : never;

export interface TestResultView {
    status?: string;
    browser?: string;
    attempt?: number;
    duration?: number | null;
    file?: string | null;
    name?: string;
    error?: string | SanitizedTestError | null;
    meta?: unknown | null;
    skipOrMuteReason?: string | null;
    id?: string;
    description?: string | null;
    url?: string | null;
    timestamp?: number | null;
    sessionId?: string | null;
    imageDir?: string | null;
    errorDetails?: SanitizedErrorDetails | null;
    steps?: TestStepView[];
    images?: SanitizedImageInfo[];
    attachments?: AttachmentView[];
}

export interface TestStepView {
    name: string;
    args: string[];
    duration: number;
    timestamp: number;
    isFailed?: boolean;
    isGroup?: boolean;
    repeat?: number;
    children?: TestStepView[];
}

export interface TestResultViewOptions {
    errorFormat?: "full" | "line";
    includeBase64?: boolean;
}

function getFailedImageInfo(result: ReporterTestResult): string | null {
    const failedImage = result.imagesInfo?.find(imageInfo => {
        const status = imageInfo.status;

        return status === "error" || status === "fail";
    });

    if (!failedImage) {
        return null;
    }

    const stateName = getImageStateName(failedImage);
    const state = stateName ? `state: ${stateName}` : null;
    const error = formatError(getImageError(failedImage));
    const message = [state, error].filter((part): part is string => part !== null).join("; ");

    return message || null;
}

function getErrorLine(result: ReporterTestResult): string | null {
    const status = result.status;
    const shouldMentionMissingError = status === "error" || status === "fail" || isMutedResult(result);

    const error = formatError(result.error) ?? getFailedImageInfo(result);

    return error ?? (shouldMentionMissingError ? "No error message" : null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeBinaryPayloads<T>(value: T, includeBase64: boolean): SanitizedPayload<T> {
    if (Array.isArray(value)) {
        return value.map(item => sanitizeBinaryPayloads(item, includeBase64)) as SanitizedPayload<T>;
    }

    if (Buffer.isBuffer(value)) {
        return (
            includeBase64
                ? value.toString("base64")
                : {
                      bufferOmitted: true,
                      byteLength: value.byteLength,
                  }
        ) as SanitizedPayload<T>;
    }

    if (!isRecord(value)) {
        return value as SanitizedPayload<T>;
    }

    const result: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
        if (key === "base64" && !includeBase64) {
            result.base64Omitted = true;
            continue;
        }

        result[key] = sanitizeBinaryPayloads(nestedValue, includeBase64);
    }

    return result as SanitizedPayload<T>;
}

function stripAnsiStrings<T>(value: T): T {
    if (typeof value === "string") {
        return stripVTControlCharacters(value) as T;
    }

    if (Array.isArray(value)) {
        return value.map(stripAnsiStrings) as T;
    }

    if (!isRecord(value)) {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [key, stripAnsiStrings(nestedValue)]),
    ) as T;
}

function sanitizePayload<T>(value: T, includeBase64: boolean): SanitizedPayload<T> {
    return stripAnsiStrings(sanitizeBinaryPayloads(value, includeBase64));
}

function sanitizeErrorPayload(value: ReporterTestError, includeBase64: boolean): SanitizedTestError;
function sanitizeErrorPayload(value: ReporterImageInfo, includeBase64: boolean): SanitizedImageInfo;
function sanitizeErrorPayload(
    value: ReporterTestError | ReporterImageInfo,
    includeBase64: boolean,
): SanitizedTestError | SanitizedImageInfo {
    return sanitizePayload(value, includeBase64);
}

function sanitizeErrorDetails(details: ReporterErrorDetails, includeBase64: boolean): SanitizedErrorDetails {
    return sanitizePayload(details, includeBase64);
}

function toTestStepView(step: ReporterTestStep): TestStepView {
    const view: TestStepView = {
        name: step.n,
        args: step.a,
        duration: step.d,
        timestamp: step.ts,
    };

    if (step.f !== undefined) {
        view.isFailed = step.f;
    }
    if (step.g !== undefined) {
        view.isGroup = step.g;
    }
    if (step.r !== undefined) {
        view.repeat = step.r;
    }
    if (step.c?.length) {
        view.children = step.c.map(toTestStepView);
    }

    return view;
}

function getAttachmentType(type: unknown): string {
    switch (type) {
        case 0:
            return "snapshot";
        case 1:
            return "badges";
        case 2:
            return "tags";
        default:
            return typeof type === "string" ? type : `unknown:${String(type)}`;
    }
}

function toAttachmentView(attachment: ReporterAttachment, includeBase64: boolean): AttachmentView {
    const { type, ...payload } = attachment;

    return {
        ...sanitizePayload(payload, includeBase64),
        type: getAttachmentType(type),
    } as AttachmentView;
}

/** Picks fields from a test result and returns a view object. */
export function toTestResultView(
    result: ReporterTestResult,
    fields?: readonly DetailedTestResultField[],
    options: TestResultViewOptions = {},
): TestResultView {
    const view: TestResultView = {};
    const outputFields = fields ?? DETAILED_TEST_RESULT_FIELDS;
    const includeBase64 = options.includeBase64 ?? false;
    const errorFormat = options.errorFormat ?? "full";

    for (const field of outputFields) {
        switch (field) {
            case "name":
                view.name = result.fullName;
                break;
            case "status":
                view.status = isMutedResult(result) ? "muted" : result.status;
                break;
            case "browser":
                view.browser = result.browserId;
                break;
            case "attempt":
                view.attempt = result.attempt;
                break;
            case "duration":
                view.duration = result.duration ?? null;
                break;
            case "file":
                view.file = result.file ?? null;
                break;
            case "error":
                if (errorFormat === "line") {
                    const errorLine = getErrorLine(result);
                    view.error = errorLine === null ? null : stripVTControlCharacters(errorLine);
                } else {
                    view.error = result.error == null ? null : sanitizeErrorPayload(result.error, includeBase64);
                }
                break;
            case "meta":
                view.meta = result.meta ?? null;
                break;
            case "skipOrMuteReason":
                view.skipOrMuteReason = result.skipReason ?? null;
                break;
            case "id":
                view.id = result.id;
                break;
            case "description":
                view.description = result.description ?? null;
                break;
            case "url":
                view.url = result.url ?? null;
                break;
            case "timestamp":
                view.timestamp = result.timestamp ?? null;
                break;
            case "sessionId":
                view.sessionId = result.sessionId ?? null;
                break;
            case "imageDir":
                view.imageDir = result.imageDir ?? null;
                break;
            case "errorDetails":
                view.errorDetails =
                    result.errorDetails == null ? null : sanitizeErrorDetails(result.errorDetails, includeBase64);
                break;
            case "steps":
                view.steps = (result.history ?? []).map(toTestStepView);
                break;
            case "images":
                view.images = (result.imagesInfo ?? []).map(imageInfo =>
                    sanitizeErrorPayload(imageInfo, includeBase64),
                );
                break;
            case "attachments":
                view.attachments = (result.attachments ?? []).map(attachment =>
                    toAttachmentView(attachment, includeBase64),
                );
                break;
        }
    }

    return view;
}
