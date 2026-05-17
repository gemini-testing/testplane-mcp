import { z } from "zod";

export const timeTravelSnapshotSchema = {
    report: z
        .string()
        .min(1)
        .transform(value => value.trim())
        .optional()
        .describe("Path or URL to a Testplane HTML report directory, report HTML file, or databaseUrls.json"),
    name: z
        .string()
        .min(1)
        .transform(value => value.trim())
        .optional()
        .describe("Full test name to inspect in report mode"),
    browser: z
        .string()
        .min(1)
        .transform(value => value.trim())
        .optional()
        .describe("Browser id to inspect in report mode"),
    attempt: z
        .number()
        .int()
        .min(0, "--attempt must be >= 0")
        .optional()
        .describe("Attempt index to inspect. Defaults to the latest attempt for the selected test and browser"),
    snapshotFile: z
        .string()
        .min(1)
        .transform(value => value.trim())
        .optional()
        .describe("Path or URL to a time travel snapshot zip. Mutually exclusive with report mode"),
    time: z
        .number()
        .finite()
        .min(0, "--time must be >= 0")
        .optional()
        .describe(
            "Time to inspect in milliseconds. Values within snapshot duration are offsets from the first rrweb event; larger values are absolute timestamps",
        ),
    diffFrom: z
        .number()
        .finite()
        .min(0, "--diff-from must be >= 0")
        .optional()
        .describe(
            "When set, return only current DOM nodes that changed between this time and the requested time. Uses the same offset/timestamp rules as time",
        ),
    includeTags: z.array(z.string()).optional().describe("HTML tags to include in the snapshot besides defaults"),
    includeAttrs: z
        .array(z.string())
        .optional()
        .describe("HTML attributes to include in the snapshot besides defaults"),
    excludeTags: z.array(z.string()).optional().describe("HTML tags to exclude from the snapshot"),
    excludeAttrs: z.array(z.string()).optional().describe("HTML attributes to exclude from the snapshot"),
    truncateText: z.boolean().optional().describe("Whether to truncate long text content (default: true)"),
    maxTextLength: z.number().positive().optional().describe("Maximum length of text content before truncation"),
};

export const timeTravelSnapshotObjectSchema = z.object(timeTravelSnapshotSchema).superRefine((args, ctx) => {
    const hasReportMode = args.report !== undefined || args.name !== undefined || args.browser !== undefined;
    const hasDirectMode = args.snapshotFile !== undefined;

    if (hasReportMode && hasDirectMode) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Use either report mode ("report", "name", "browser") or direct mode ("snapshotFile"), not both.',
        });
        return;
    }

    if (hasDirectMode) {
        if (args.time === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["time"],
                message: '"time" is required when using "snapshotFile".',
            });
        }
        return;
    }

    if (!args.report || !args.name || !args.browser) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
                'Provide either "snapshotFile" with "time" or all report mode fields: "report", "name", and "browser".',
        });
    }
});

export type TimeTravelSnapshotArgs = z.output<typeof timeTravelSnapshotObjectSchema>;
