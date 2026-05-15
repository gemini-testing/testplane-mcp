import { build } from "esbuild";
import { rm } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const outdir = resolve(pkgRoot, "build");

await rm(outdir, { recursive: true, force: true });

await build({
    entryPoints: [resolve(pkgRoot, "src/cli.ts")],
    outfile: resolve(outdir, "cli.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    sourcemap: true,
    external: ["testplane", "@testplane/testing-library", "@modelcontextprotocol/sdk", "commander", "zod"],
    logLevel: "info",
});
