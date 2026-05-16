import { z } from "zod";
import {
    DEFAULT_TEST_RESULT_FIELDS,
    TEST_RESULT_FIELDS,
    TEST_RESULT_STATUSES,
    type DurationFilter,
    type FileMaskFilter,
    type MetaFilter,
    type RegexFilter,
    type TestResultField,
    type TestResultStatus,
} from "./types.js";

export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 500;

function splitCommaSeparated(value: string | undefined): string[] {
    return (value ?? "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
}

function parseRegexFilter(value: string | undefined, ctx: z.RefinementCtx): RegexFilter | undefined {
    if (!value) {
        return undefined;
    }

    try {
        return {
            source: value,
            regex: new RegExp(value),
        };
    } catch (error) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid regex "${value}": ${error instanceof Error ? error.message : String(error)}`,
        });

        return z.NEVER;
    }
}

function parseStatusFilter(value: string | undefined, ctx: z.RefinementCtx): TestResultStatus[] {
    const statuses = splitCommaSeparated(value).map(status => status.toLowerCase());
    const allowedStatuses: readonly string[] = TEST_RESULT_STATUSES;
    const unknownStatuses = statuses.filter(status => !allowedStatuses.includes(status));

    if (unknownStatuses.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid status filter "${unknownStatuses.join(",")}". Allowed values: ${TEST_RESULT_STATUSES.join(", ")}.`,
        });

        return z.NEVER;
    }

    return statuses as TestResultStatus[];
}

function parseDurationFilter(value: string | undefined, ctx: z.RefinementCtx): DurationFilter | undefined {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    const match = trimmed.match(/^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+)?)\s*(ms|s|m)?$/i);

    if (!match) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid duration filter "${value}". Use a format like >5s or >100ms.`,
        });

        return z.NEVER;
    }

    const unit = (match[3] ?? "ms").toLowerCase();
    const multiplier = unit === "m" ? 60_000 : unit === "s" ? 1000 : 1;

    return {
        source: trimmed,
        operator: (match[1] ?? ">=") as DurationFilter["operator"],
        durationMs: Number(match[2]) * multiplier,
    };
}

function parseMetaFilters(value: string[] | undefined, ctx: z.RefinementCtx): MetaFilter[] {
    return (value ?? []).map(rawFilter => {
        const separatorIndex = rawFilter.indexOf("=");
        const key = rawFilter.slice(0, separatorIndex).trim();

        if (separatorIndex <= 0 || !key) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Invalid meta filter "${rawFilter}". Use key=value.`,
            });

            return z.NEVER;
        }

        return {
            source: rawFilter,
            key,
            value: rawFilter.slice(separatorIndex + 1).trim(),
        };
    });
}

function globToRegex(glob: string): RegExp {
    let source = "";

    for (let i = 0; i < glob.length; i += 1) {
        const char = glob[i];
        const nextChar = glob[i + 1];

        if (char === "*" && nextChar === "*") {
            source += ".*";
            i += 1;
            continue;
        }

        if (char === "*") {
            source += "[^/]*";
            continue;
        }

        if (char === "?") {
            source += "[^/]";
            continue;
        }

        source += char.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
    }

    return new RegExp(`^${source}$`);
}

function parseFileMasks(value: string | undefined): FileMaskFilter[] {
    return splitCommaSeparated(value).map(mask => {
        const normalizedMask = mask.replace(/\\/g, "/");

        return {
            source: mask,
            basenameOnly: !normalizedMask.includes("/"),
            regex: globToRegex(normalizedMask),
        };
    });
}

function parseOutputFields(value: string, ctx: z.RefinementCtx): TestResultField[] {
    const fields = splitCommaSeparated(value);
    const allowedFields: readonly string[] = TEST_RESULT_FIELDS;
    const unknownFields = fields.filter(field => !allowedFields.includes(field));

    if (!fields.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid fields filter. Allowed values: ${TEST_RESULT_FIELDS.join(", ")}.`,
        });

        return z.NEVER;
    }

    if (unknownFields.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid fields filter "${unknownFields.join(",")}". Allowed values: ${TEST_RESULT_FIELDS.join(", ")}.`,
        });

        return z.NEVER;
    }

    return fields as TestResultField[];
}

export const testResultsSchema = {
    report: z
        .string()
        .min(1)
        .transform(value => value.trim())
        .describe("Path or URL to a Testplane HTML report directory, report HTML file, or databaseUrls.json"),
    limit: z
        .number()
        .int()
        .min(1, `--limit must be in 1..${MAX_LIST_LIMIT}`)
        .max(MAX_LIST_LIMIT, `--limit must be in 1..${MAX_LIST_LIMIT}`)
        .default(DEFAULT_LIST_LIMIT)
        .describe(
            `Maximum number of test results to print in text output. Default: ${DEFAULT_LIST_LIMIT}, max: ${MAX_LIST_LIMIT}`,
        ),
    offset: z
        .number()
        .int()
        .min(0, "--offset must be >= 0")
        .default(0)
        .describe("Number of matched test results to skip before listing in text output"),
    grep: z.string().optional().transform(parseRegexFilter).describe("Regex to match against the full test name"),
    status: z
        .string()
        .optional()
        .transform(parseStatusFilter)
        .describe(
            `Comma-separated status filter. Allowed: ${TEST_RESULT_STATUSES.join(", ")}. failed includes error and fail report statuses.`,
        ),
    browser: z.string().optional().transform(splitCommaSeparated).describe("Comma-separated browserId filter"),
    duration: z
        .string()
        .optional()
        .transform(parseDurationFilter)
        .describe("Duration filter, for example >5s, >=100ms, <2s, or =500ms"),
    grepError: z.string().optional().transform(parseRegexFilter).describe("Regex to match against error text"),
    meta: z
        .array(z.string())
        .optional()
        .transform(parseMetaFilters)
        .describe("Meta filters in key=value form. Can be repeated"),
    file: z
        .string()
        .optional()
        .transform(parseFileMasks)
        .describe("File path mask. Supports simple glob masks such as src/** or *.test.js"),
    saveJson: z
        .boolean()
        .default(false)
        .describe(
            "Save the whole filtered report as JSON without pagination to a file under os.tmpdir()/testplane-cli, then print the path, summary, and example file fragment. Useful for saving output to a file for later interaction via scripts; saves the whole report instead of only the current page. Result fields are controlled by --fields.",
        ),
    fields: z
        .string()
        .default(DEFAULT_TEST_RESULT_FIELDS.join(","))
        .transform(parseOutputFields)
        .describe(
            `Comma-separated output fields for text and saved JSON. Allowed: ${TEST_RESULT_FIELDS.join(", ")}. Default: ${DEFAULT_TEST_RESULT_FIELDS.join(",")}`,
        ),
};

export const testResultsObjectSchema = z.object(testResultsSchema);
export type TestResultsArgs = z.output<typeof testResultsObjectSchema>;
