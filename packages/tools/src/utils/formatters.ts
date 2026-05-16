import { firstNonEmptyLine, truncateText } from "./strings.js";

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTimestamp(timestamp: number = Date.now()): string {
    return new Date(timestamp).toISOString().replace(/[:.]/g, "-");
}

export function formatDuration(duration: number | null | undefined): string | null {
    if (duration === null || duration === undefined || !Number.isFinite(duration)) {
        return null;
    }

    return duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
}

const DEFAULT_ERROR_MAX_LENGTH = 256;

export function formatError(
    error: Partial<Error> | null | undefined,
    maxLength = DEFAULT_ERROR_MAX_LENGTH,
): string | null {
    const firstLine = firstNonEmptyLine(error?.message) ?? firstNonEmptyLine(error?.stack);

    if (!firstLine) {
        return null;
    }

    const errorPrefix = error?.name && !firstLine.startsWith(`${error.name}:`) ? `${error.name}: ` : "";

    return truncateText(`${errorPrefix}${firstLine}`, maxLength);
}
