import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export interface SocketPaths {
    dir: string;
    socket: string;
    log: string;
}

export function findProjectRoot(cwd: string = process.cwd()): string {
    let dir = path.resolve(cwd);
    while (true) {
        if (fs.existsSync(path.join(dir, "package.json"))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return path.resolve(cwd);
        dir = parent;
    }
}

export function socketPathFor(projectRoot: string = findProjectRoot()): SocketPaths {
    const override = process.env.TESTPLANE_CLI_SOCKET_OVERRIDE;
    if (override) {
        const dir = path.dirname(override);
        const base = path.basename(override).replace(/\.sock$/i, "");

        return {
            dir,
            socket: override,
            log: path.join(dir, `${base}.log`),
        };
    }

    const hash = crypto.createHash("sha1").update(projectRoot).digest("hex").slice(0, 6);
    const name = path.basename(projectRoot);
    const dir = path.join(os.homedir(), ".testplane", "cli");

    return {
        dir,
        socket: path.join(dir, `${hash}-${name}.sock`),
        log: path.join(dir, `${hash}-${name}.log`),
    };
}
