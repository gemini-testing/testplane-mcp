import path from "node:path";
import { fileURLToPath } from "node:url";
import { readResultsFromReport } from "html-reporter/experimental/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
    findReportTestResult,
    diffPageSnapshots,
    getReportDefaultTime,
    getSnapshotAttachment,
    loadRrwebSnapshotArchive,
    resolveSnapshotAttachmentSource,
    resolveTargetTime,
    timeTravelSnapshot,
    timeTravelSnapshotObjectSchema,
} from "../../src/tools/time-travel-snapshot/index.js";
import { formatReportTestSteps } from "../../src/tools/time-travel-snapshot/formatters.js";
import { getTextContent } from "../setup.js";

const SAMPLE_REPORT = fileURLToPath(new URL("../fixtures/sample-html-report", import.meta.url));
const SAMPLE_SNAPSHOT = path.join(SAMPLE_REPORT, "snapshots/2570334/chrome_1778522878896_1.zip");

type TimeTravelSnapshotInput = z.input<typeof timeTravelSnapshotObjectSchema>;

function parseArgs(args: TimeTravelSnapshotInput) {
    return timeTravelSnapshotObjectSchema.parse(args);
}

describe("tools/time-travel-snapshot", () => {
    it("validates report mode and direct mode", () => {
        expect(
            timeTravelSnapshotObjectSchema.safeParse({
                report: SAMPLE_REPORT,
                name: "success describe successfully passed test",
                browser: "chrome",
            }).success,
        ).toBe(true);

        expect(timeTravelSnapshotObjectSchema.safeParse({ snapshotFile: SAMPLE_SNAPSHOT, time: 134 }).success).toBe(
            true,
        );
        expect(
            timeTravelSnapshotObjectSchema.safeParse({ snapshotFile: SAMPLE_SNAPSHOT, time: 134, diffFrom: 10 })
                .success,
        ).toBe(true);

        expect(
            timeTravelSnapshotObjectSchema.safeParse({
                report: SAMPLE_REPORT,
                name: "success describe successfully passed test",
                browser: "chrome",
                snapshotFile: SAMPLE_SNAPSHOT,
                time: 134,
            }).success,
        ).toBe(false);

        expect(timeTravelSnapshotObjectSchema.safeParse({ snapshotFile: SAMPLE_SNAPSHOT }).success).toBe(false);
        expect(
            timeTravelSnapshotObjectSchema.safeParse({ snapshotFile: SAMPLE_SNAPSHOT, time: 134, diffFrom: -1 })
                .success,
        ).toBe(false);
        expect(timeTravelSnapshotObjectSchema.safeParse({ report: SAMPLE_REPORT, name: "test" }).success).toBe(false);
    });

    it("loads rrweb snapshot archives and resolves smart time values", async () => {
        const archive = await loadRrwebSnapshotArchive(SAMPLE_SNAPSHOT);

        expect(archive.events).toHaveLength(5);
        expect(archive.metadata).toMatchObject({
            startTime: 1778522878903,
            endTime: 1778522879143,
            totalTime: 240,
            width: 1280,
            height: 1024,
        });

        const offsetTime = resolveTargetTime(archive.metadata, { time: 134 });
        expect(offsetTime).toMatchObject({
            absoluteTime: 1778522879037,
            offsetMs: 134,
            requestedKind: "offset",
            wasClamped: false,
        });

        const timestampTime = resolveTargetTime(archive.metadata, { time: 1778522879143 });
        expect(timestampTime).toMatchObject({
            absoluteTime: 1778522879143,
            offsetMs: 240,
            requestedKind: "timestamp",
            wasClamped: false,
        });

        const clampedTime = resolveTargetTime(archive.metadata, { time: 999_999 });
        expect(clampedTime).toMatchObject({
            absoluteTime: 1778522878903,
            offsetMs: 0,
            requestedKind: "timestamp",
            wasClamped: true,
        });
    });

    it("selects report attempts, resolves snapshot attachments, and picks default times", async () => {
        const results = await readResultsFromReport(SAMPLE_REPORT);
        const result = findReportTestResult(results, {
            name: "failed describe test with image comparison diff",
            browser: "chrome",
        });
        const attachment = getSnapshotAttachment(result);
        const source = await resolveSnapshotAttachmentSource(SAMPLE_REPORT, SAMPLE_REPORT, attachment.path);
        const defaultTime = getReportDefaultTime(result);

        expect(result.attempt).toBe(1);
        expect(attachment.path).toBe("snapshots/ba3c69a/chrome_1778522876782_1.zip");
        expect(source).toBe(path.join(SAMPLE_REPORT, "snapshots/ba3c69a/chrome_1778522876782_1.zip"));
        expect(defaultTime).toEqual({
            absoluteTime: 1778522877240,
            reason: "default fail result end",
        });
    });

    it("prefers failed step end as the report default time", () => {
        const result = {
            status: "fail",
            timestamp: 100,
            duration: 500,
            history: [
                { n: "first", a: [], ts: 110, d: 10 },
                {
                    n: "group",
                    a: [],
                    ts: 130,
                    d: 100,
                    g: true,
                    c: [{ n: "failed action", a: [], ts: 140, d: 20, f: true }],
                },
            ],
        };

        expect(getReportDefaultTime(result as never)).toEqual({
            absoluteTime: 160,
            reason: 'default failed step "failed action" end',
        });
    });

    it("formats concise report steps from report history", async () => {
        const results = await readResultsFromReport(SAMPLE_REPORT);
        const result = findReportTestResult(results, {
            name: "failed describe test with image comparison diff",
            browser: "chrome",
        });
        const steps = formatReportTestSteps(result, result.timestamp);

        expect(steps).toContain('Times are offsets from the first rrweb event; use them as "time" values.');
        expect(steps).toContain('- +8ms..+22ms setWindowSize("1280", "1024")');
        expect(steps).toContain('- +235ms..+361ms assertView("header", "header")');
        expect(steps).toContain('- +361ms..+375ms execute("code")');
    });

    it("formats the full failed step group tree when history marks it", () => {
        const result = {
            history: [
                { n: "first", a: [], ts: 110, d: 10 },
                {
                    n: "group",
                    a: [],
                    ts: 130,
                    d: 100,
                    g: true,
                    f: true,
                    c: [{ n: "failed action", a: ["arg"], ts: 140, d: 20, f: true }],
                },
                { n: "after", a: [], ts: 250, d: 10 },
            ],
        };

        const steps = formatReportTestSteps(result as never, 100);

        expect(steps).toContain("- +10ms..+20ms first");
        expect(steps).toContain("! +30ms..+130ms group");
        expect(steps).toContain('  ! +40ms..+60ms failed action("arg")');
        expect(steps).toContain("- +150ms..+160ms after");
    });

    it("preserves ancestor structure when diffing formatted snapshots", () => {
        const baseline = {
            fenceLanguage: "yaml" as const,
            content: [
                "# Note: baseline",
                "- body:",
                " - main:",
                "  - section.card:",
                '   - span "old"',
                " - footer:",
                '  - span "same"',
            ].join("\n"),
        };
        const target = {
            fenceLanguage: "yaml" as const,
            content: [
                "# Note: target",
                "- body:",
                " - main:",
                "  - section.card:",
                '   - span "new"',
                " - footer:",
                '  - span "same"',
            ].join("\n"),
        };

        const diff = diffPageSnapshots(baseline, target);

        expect(diff.fenceLanguage).toBe("diff");
        expect(diff.content).toContain("~ body");
        expect(diff.content).toContain("  ...");
        expect(diff.content).toContain("  ~ main");
        expect(diff.content).toContain("    ~ section.card");
        expect(diff.content).toContain('      ~ span "new"');
        expect(diff.content).toContain('        text: "old" -> "new"');
        expect(diff.content).not.toContain("footer");
    });

    it("returns an empty diff marker when formatted snapshots match", () => {
        const snapshot = {
            fenceLanguage: "yaml" as const,
            content: ["# Note: target", "- body:", " - main:"].join("\n"),
        };

        expect(diffPageSnapshots(snapshot, snapshot)).toEqual({
            fenceLanguage: "diff",
            content: "# No DOM nodes changed between the selected times.",
        });
    });

    it("folds parent-only changes and omits unchanged descendants", () => {
        const baseline = {
            fenceLanguage: "yaml" as const,
            content: ["- main.main:", " - div:", '  - span "same"'].join("\n"),
        };
        const target = {
            fenceLanguage: "yaml" as const,
            content: ["- main.main.main_forced:", " - div:", '  - span "same"'].join("\n"),
        };
        const diff = diffPageSnapshots(baseline, target);

        expect(diff.content).toContain("~ main.main.main_forced");
        expect(diff.content).toContain("  classes:");
        expect(diff.content).toContain("    + main_forced");
        expect(diff.content).toContain("  children unchanged: 2 nodes omitted");
        expect(diff.content).not.toContain("span");
    });

    it("renders added subtrees with structure", () => {
        const baseline = {
            fenceLanguage: "yaml" as const,
            content: "- body:",
        };
        const target = {
            fenceLanguage: "yaml" as const,
            content: [
                "- body:",
                " - div.HeaderFormSearchThemesSection-Wrapper:",
                "  - section.SearchThemesSection:",
                "   - ul.SearchThemesSection-List:",
                "    - li:",
                "     - a.Link:",
                '      - span "Квартиры"',
            ].join("\n"),
        };
        const diff = diffPageSnapshots(baseline, target);

        expect(diff.content).toContain("~ body");
        expect(diff.content).toContain("  + div.HeaderFormSearchThemesSection-Wrapper");
        expect(diff.content).toContain("    + section.SearchThemesSection");
        expect(diff.content).toContain('            + span "Квартиры"');
    });

    it("renders class and attr changes on matched nodes", () => {
        const baseline = {
            fenceLanguage: "yaml" as const,
            content:
                '- form.HeaderForm.mini-suggest_has-value_yes[action=/search/ aria-label="Old label" name=yandex role=search]:',
        };
        const target = {
            fenceLanguage: "yaml" as const,
            content:
                '- form.HeaderForm.mini-suggest_expanded.HeaderForm_search_themes-visible[action=/search/ aria-label="New label" name=yandex role=search @hidden]:',
        };
        const diff = diffPageSnapshots(baseline, target);

        expect(diff.content).toContain(
            '~ form.HeaderForm.mini-suggest_expanded.HeaderForm_search_themes-visible[role="search" name="yandex" aria-label="New label"]',
        );
        expect(diff.content).toContain("  classes:");
        expect(diff.content).toContain("    - mini-suggest_has-value_yes");
        expect(diff.content).toContain("    + HeaderForm_search_themes-visible");
        expect(diff.content).toContain("    + mini-suggest_expanded");
        expect(diff.content).toContain("  attrs:");
        expect(diff.content).toContain("    + @hidden");
        expect(diff.content).toContain('    ~ aria-label: "Old label" -> "New label"');
    });

    it("matches similar siblings when generated ids change", () => {
        const baseline = {
            fenceLanguage: "yaml" as const,
            content: ["- body:", " - div.Root#old-generated[role=region]:", '  - span "old"'].join("\n"),
        };
        const target = {
            fenceLanguage: "yaml" as const,
            content: ["- body:", " - div.Root#new-generated[role=region]:", '  - span "new"'].join("\n"),
        };
        const diff = diffPageSnapshots(baseline, target);

        expect(diff.content).toContain('~ div.Root#new-generated[role="region"]');
        expect(diff.content).toContain('id: "old-generated" -> "new-generated"');
        expect(diff.content).toContain('~ span "new"');
        expect(diff.content).not.toContain("- div.Root#old-generated");
        expect(diff.content).not.toContain("+ div.Root#new-generated");
    });

    it("truncates long attr values in rendered diffs", () => {
        const longUrl = `https://example.com/search?text=${"x".repeat(200)}`;
        const baseline = {
            fenceLanguage: "yaml" as const,
            content: '- a.Link[href=https://example.com] "Link"',
        };
        const target = {
            fenceLanguage: "yaml" as const,
            content: `- a.Link[href="${longUrl}"] "Link"`,
        };
        const diff = diffPageSnapshots(baseline, target);

        expect(diff.content).toContain("...");
        expect(diff.content).not.toContain("x".repeat(160));
    });

    it("renders a time travel snapshot and captures the rrweb iframe DOM", async () => {
        const result = await timeTravelSnapshot.cb(
            parseArgs({
                snapshotFile: SAMPLE_SNAPSHOT,
                time: 134,
                includeAttrs: ["class"],
                truncateText: false,
            }),
        );
        const text = getTextContent(result);

        expect(result.isError).toBe(false);
        expect(text).toContain("Time travel snapshot captured");
        expect(text).toContain("## Selected Time");
        expect(text).toContain("Reason: provided offset 134ms from first rrweb event");
        expect(text).toContain("Some header");
        expect(text).toContain("Lorem ipsum dolor sit amet");
    }, 30_000);
});
