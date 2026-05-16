import { downloadReport, type ReporterTestResult } from "html-reporter/experimental/sdk";
import { DEFAULT_REMOTE_RESOURCE_CACHE_ROOT, resolveCachedRemoteResource } from "./remote-resource-cache.js";
import type { ReporterImageInfo } from "../tools/test-results/types.js";

const DATABASE_URLS_FILE = "databaseUrls.json";

function isRemoteReport(report: string): boolean {
    try {
        const url = new URL(report);

        return Boolean(url.host && url.protocol !== "file:");
    } catch {
        return false;
    }
}

export async function downloadReportIfNeeded(
    reportPathOrUrl: string,
    cacheRoot = DEFAULT_REMOTE_RESOURCE_CACHE_ROOT,
): Promise<string> {
    if (!isRemoteReport(reportPathOrUrl)) {
        return reportPathOrUrl;
    }

    return resolveCachedRemoteResource(reportPathOrUrl, {
        cacheRoot,
        requiredFiles: [DATABASE_URLS_FILE],
        download: async cacheDir => {
            const result = await downloadReport(reportPathOrUrl, cacheDir, { files: ["dbFiles"] });

            return result.reportPath;
        },
    });
}

export function getImageStateName(imageInfo: ReporterImageInfo): string | null {
    return "stateName" in imageInfo ? (imageInfo.stateName ?? null) : null;
}

export function getImageError(imageInfo: ReporterImageInfo): Partial<Error> | null {
    return "error" in imageInfo ? (imageInfo.error ?? null) : null;
}

export function isMutedResult(result: ReporterTestResult): boolean {
    return result.status === "success" && Boolean(result.meta?.muteReason);
}
