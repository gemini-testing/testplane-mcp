import { z } from "zod";

export const inspectResultSchema = {
    report: z
        .string()
        .min(1)
        .transform(value => value.trim())
        .describe("Path or URL to a Testplane HTML report directory, report HTML file, or databaseUrls.json"),
    name: z
        .string()
        .min(1)
        .transform(value => value.trim())
        .describe("Full test name to inspect"),
    browser: z
        .string()
        .min(1)
        .transform(value => value.trim())
        .describe("Browser id to inspect"),
    attempt: z
        .number()
        .int()
        .min(0, "--attempt must be >= 0")
        .optional()
        .describe("Attempt index to inspect. Defaults to the latest attempt for the selected test and browser"),
    pretty: z.boolean().default(true).describe("Pretty-print JSON output. Use --no-pretty for compact JSON"),
    includeBase64: z
        .boolean()
        .default(false)
        .describe(
            "Include base64 image payloads in result images and errors. Omitted by default to keep output compact",
        ),
};

export const inspectResultObjectSchema = z.object(inspectResultSchema);
export type InspectResultArgs = z.output<typeof inspectResultObjectSchema>;
