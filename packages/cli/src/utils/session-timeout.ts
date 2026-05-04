export const DEFAULT_SESSION_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_ENV = "TESTPLANE_CLI_SESSION_TTL_MS";

export function parseSessionTtlMs(value: string | undefined): number {
    const rawValue = value?.trim();
    if (rawValue === undefined || rawValue === "") {
        return DEFAULT_SESSION_TTL_MS;
    }

    if (!/^\d+$/.test(rawValue)) {
        throw new Error(`${SESSION_TTL_ENV} must be a positive integer number of milliseconds`);
    }

    const ttlMs = Number(rawValue);
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
        throw new Error(`${SESSION_TTL_ENV} must be a positive integer number of milliseconds`);
    }

    return ttlMs;
}
