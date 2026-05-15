import type { Response } from "./ipc/protocol.js";

export function renderAndExit(response: Response): never {
    if (response.kind === "error") {
        process.stderr.write(`${response.message}\n`);
        process.exit(2);
    }

    const text = response.content
        .filter(c => c.type === "text")
        .map(c => c.text ?? "")
        .join("\n");

    process.stdout.write(text.endsWith("\n") ? text : text + "\n");
    process.exit(response.isError ? 1 : 0);
}
