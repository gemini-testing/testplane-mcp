import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        silent: false,
        printConsoleTrace: true,
        environment: "node",
        include: ["test/**/*.test.ts"],
        exclude: ["node_modules", "build"],
        coverage: {
            reporter: ["text", "html"],
            exclude: ["node_modules/", "build/", "test/"],
        },
    },
});
