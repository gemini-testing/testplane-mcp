import { describe, expect, it } from "vitest";
import { z } from "zod";

import { formatError } from "../../src/utils/error.js";

describe("utils/error", () => {
    it("formats zod validation errors as one-line CLI messages", () => {
        const result = z
            .object({
                limit: z.number().min(1, "--limit must be in 1..1000").max(1000, "--limit must be in 1..1000"),
                offset: z.number().min(0, "--offset must be >= 0"),
            })
            .safeParse({ limit: 2000, offset: -1 });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(formatError(result.error)).toBe("--limit must be in 1..1000; --offset must be >= 0");
        }
    });
});
