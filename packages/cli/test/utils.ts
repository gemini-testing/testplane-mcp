import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CLI_JS = path.join(__dirname, "../build/cli.js");
export const E2E_TIMEOUT = 60_000;

export interface CliResult {
    stdout: string;
    stderr: string;
    code: number;
}

export function runCli(args: string[], extraEnv: Record<string, string> = {}): Promise<CliResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI_JS, ...args], {
            env: { ...process.env, ...extraEnv },
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d: Buffer) => {
            stdout += d.toString();
        });
        child.stderr.on("data", (d: Buffer) => {
            stderr += d.toString();
        });
        child.once("close", code => resolve({ stdout, stderr, code: code ?? 0 }));
        child.once("error", reject);
    });
}
