import { z } from "zod";
import { kebabCase } from "../zod-to-commander.js";

export function formatError(error: unknown): string {
    if (error instanceof z.ZodError) {
        return error.issues
            .map(issue => {
                if (issue.message.startsWith("--")) {
                    return issue.message;
                }

                const field = issue.path.length ? `--${kebabCase(String(issue.path[0]))}` : "Arguments";

                return `${field}: ${issue.message}`;
            })
            .join("; ");
    }

    if (error instanceof Error) {
        return error.stack ?? error.message;
    }

    return String(error);
}
