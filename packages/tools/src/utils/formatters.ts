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

export function formatDuration(duration: number | undefined): string | undefined {
    if (duration === undefined || !Number.isFinite(duration)) {
        return undefined;
    }

    return duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
}

const DEFAULT_ERROR_MAX_LENGTH = 256;

export function formatError(
    error: Partial<Error> | null | undefined,
    maxLength = DEFAULT_ERROR_MAX_LENGTH,
): string | undefined {
    const firstLine = firstNonEmptyLine(error?.message) ?? firstNonEmptyLine(error?.stack);

    if (!firstLine) {
        return undefined;
    }

    const errorPrefix = error?.name && !firstLine.startsWith(`${error.name}:`) ? `${error.name}: ` : "";

    return truncateText(`${errorPrefix}${firstLine}`, maxLength);
}
