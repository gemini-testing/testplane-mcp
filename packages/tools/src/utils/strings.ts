export function truncateText(value: string, maxLength: number): string {
    const compact = value.replace(/\s+/g, " ").trim();

    return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}

export function firstNonEmptyLine(value: string | undefined): string | undefined {
    return value
        ?.split(/\r?\n/)
        .map(line => line.trim())
        .find(Boolean);
}

export function stringify(value: unknown): string {
    if (value === undefined || value === null) {
        return "";
    }

    return typeof value === "object" ? JSON.stringify(value) : String(value);
}
