import crypto from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_INFO_FILE = "cache-info.json";

export const DEFAULT_REMOTE_RESOURCE_CACHE_ROOT = path.join(os.homedir(), ".testplane", "cli", "cache");

export interface RemoteResourceCacheInfo {
    saveTime: number | string;
    labels: {
        resourceUrl?: string;
    };
}

interface ResolveCachedRemoteResourceOptions {
    cacheRoot?: string;
    saveTime?: number;
    requiredFiles?: string[];
    ttlMs?: number;
    download: (cacheDir: string) => Promise<string>;
}

function getSaveTimeMs(saveTime: number | string | undefined): number | null {
    if (typeof saveTime === "number" && Number.isFinite(saveTime)) {
        return saveTime;
    }

    if (typeof saveTime === "string") {
        const parsed = Date.parse(saveTime);

        return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
}

function getCacheDir(resourceUrl: string, cacheRoot = DEFAULT_REMOTE_RESOURCE_CACHE_ROOT): string {
    const key = crypto.createHash("sha256").update(resourceUrl).digest("hex");

    return path.join(cacheRoot, key);
}

async function pathExists(filePath: string): Promise<boolean> {
    try {
        await stat(filePath);

        return true;
    } catch {
        return false;
    }
}

export async function readRemoteResourceCacheInfo(
    resourceUrl: string,
    cacheRoot = DEFAULT_REMOTE_RESOURCE_CACHE_ROOT,
): Promise<RemoteResourceCacheInfo | null> {
    try {
        const cacheDir = getCacheDir(resourceUrl, cacheRoot);
        const cacheInfo = await readFile(path.join(cacheDir, CACHE_INFO_FILE), "utf8");

        return JSON.parse(cacheInfo) as RemoteResourceCacheInfo;
    } catch {
        return null;
    }
}

async function writeCacheInfo(cacheDir: string, resourceUrl: string, saveTime: number): Promise<void> {
    const cacheInfo: RemoteResourceCacheInfo = {
        saveTime,
        labels: {
            resourceUrl,
        },
    };

    const cacheInfoFilePath = path.join(cacheDir, CACHE_INFO_FILE);
    const cacheInfoContent = `${JSON.stringify(cacheInfo, null, 2)}\n`;

    await writeFile(cacheInfoFilePath, cacheInfoContent, "utf8");
}

export async function isRemoteResourceCached(
    resourceUrl: string,
    cacheRoot = DEFAULT_REMOTE_RESOURCE_CACHE_ROOT,
    now = Date.now(),
    requiredFiles: string[] = [],
    ttlMs = DEFAULT_CACHE_TTL_MS,
): Promise<boolean> {
    const cacheInfo = await readRemoteResourceCacheInfo(resourceUrl, cacheRoot);
    const saveTime = getSaveTimeMs(cacheInfo?.saveTime);
    const cacheDir = getCacheDir(resourceUrl, cacheRoot);

    if (cacheInfo?.labels?.resourceUrl !== resourceUrl || saveTime === null || now - saveTime > ttlMs) {
        return false;
    }

    const requiredFilesExist = await Promise.all(requiredFiles.map(file => pathExists(path.join(cacheDir, file))));

    return requiredFilesExist.every(Boolean);
}

async function cleanupExpiredRemoteResourceCaches(
    cacheRoot = DEFAULT_REMOTE_RESOURCE_CACHE_ROOT,
    now = Date.now(),
    ttlMs = DEFAULT_CACHE_TTL_MS,
): Promise<void> {
    await mkdir(cacheRoot, { recursive: true });

    const entries = await readdir(cacheRoot, { withFileTypes: true });

    await Promise.all(
        entries
            .filter(entry => entry.isDirectory())
            .map(async entry => {
                const cacheDir = path.join(cacheRoot, entry.name);
                let saveTime: number | null = null;

                try {
                    const cacheInfoContent = await readFile(path.join(cacheDir, CACHE_INFO_FILE), "utf8");
                    const cacheInfo = JSON.parse(cacheInfoContent) as RemoteResourceCacheInfo;
                    saveTime = getSaveTimeMs(cacheInfo.saveTime);
                } catch {
                    saveTime = null;
                }

                if (now - (saveTime ?? (await stat(cacheDir)).mtimeMs) > ttlMs) {
                    await rm(cacheDir, { recursive: true, force: true });
                }
            }),
    );
}

/** Returns a cached resource path or downloads and caches a new resource */
export async function resolveCachedRemoteResource(
    resourceUrl: string,
    {
        cacheRoot = DEFAULT_REMOTE_RESOURCE_CACHE_ROOT,
        download,
        saveTime = Date.now(),
        requiredFiles = [],
        ttlMs = DEFAULT_CACHE_TTL_MS,
    }: ResolveCachedRemoteResourceOptions,
): Promise<string> {
    await cleanupExpiredRemoteResourceCaches(cacheRoot);

    const cacheDir = getCacheDir(resourceUrl, cacheRoot);

    if (await isRemoteResourceCached(resourceUrl, cacheRoot, saveTime, requiredFiles, ttlMs)) {
        return cacheDir;
    }

    await rm(cacheDir, { recursive: true, force: true });
    await mkdir(cacheDir, { recursive: true });

    try {
        const resolvedPath = await download(cacheDir);

        await writeCacheInfo(cacheDir, resourceUrl, saveTime);

        return resolvedPath;
    } catch (error) {
        await rm(cacheDir, { recursive: true, force: true });
        throw error;
    }
}
