import os from "os";
import path from "path";
import fs from "fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { findProjectRoot, socketPathFor } from "../../src/ipc/socket-path.js";

const ORIGINAL_OVERRIDE = process.env.TESTPLANE_CLI_SOCKET_OVERRIDE;

describe("ipc/socket-path", () => {
    let tmpRoot: string;

    beforeEach(() => {
        // realpath avoids macOS /var -> /private/var symlink mismatches in assertions.
        tmpRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "testplane-cli-sp-")));
        delete process.env.TESTPLANE_CLI_SOCKET_OVERRIDE;
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
        if (ORIGINAL_OVERRIDE !== undefined) {
            process.env.TESTPLANE_CLI_SOCKET_OVERRIDE = ORIGINAL_OVERRIDE;
        } else {
            delete process.env.TESTPLANE_CLI_SOCKET_OVERRIDE;
        }
    });

    describe("findProjectRoot", () => {
        it("returns the directory containing package.json", () => {
            fs.writeFileSync(path.join(tmpRoot, "package.json"), "{}");
            expect(findProjectRoot(tmpRoot)).toBe(tmpRoot);
        });

        it("walks up to find package.json", () => {
            fs.writeFileSync(path.join(tmpRoot, "package.json"), "{}");
            const nested = path.join(tmpRoot, "a", "b", "c");
            fs.mkdirSync(nested, { recursive: true });
            expect(findProjectRoot(nested)).toBe(tmpRoot);
        });

        it("falls back to cwd when no package.json is found walking up", () => {
            // tmpRoot has no package.json; walking up eventually hits the FS root.
            // findProjectRoot returns the original cwd unchanged.
            const result = findProjectRoot(tmpRoot);
            expect(result).toBe(path.resolve(tmpRoot));
        });
    });

    describe("socketPathFor", () => {
        it("places the socket under ~/.testplane/cli/ with a hash-name prefix", () => {
            const projectRoot = path.join(tmpRoot, "my-project");
            fs.mkdirSync(projectRoot, { recursive: true });
            const paths = socketPathFor(projectRoot);

            const expectedDir = path.join(os.homedir(), ".testplane", "cli");
            expect(paths.dir).toBe(expectedDir);
            expect(path.dirname(paths.socket)).toBe(expectedDir);
            expect(path.dirname(paths.log)).toBe(expectedDir);

            const base = path.basename(paths.socket);
            expect(base).toMatch(/^[0-9a-f]{6}-my-project\.sock$/);

            expect(path.basename(paths.log)).toBe(base.replace(/\.sock$/, ".log"));
        });

        it("hash is stable for the same project root", () => {
            const a = socketPathFor("/home/fake/project-alpha");
            const b = socketPathFor("/home/fake/project-alpha");
            expect(a.socket).toBe(b.socket);
        });

        it("hash differs between different project roots (even same basename)", () => {
            const a = socketPathFor("/home/fake/project-alpha");
            const b = socketPathFor("/other/fake/project-alpha");
            expect(a.socket).not.toBe(b.socket);
            // basename still matches since directory name is the same
            expect(path.basename(a.socket).split("-").slice(1).join("-")).toBe("project-alpha.sock");
            expect(path.basename(b.socket).split("-").slice(1).join("-")).toBe("project-alpha.sock");
        });

        it("honors TESTPLANE_CLI_SOCKET_OVERRIDE", () => {
            const override = path.join(tmpRoot, "custom.sock");
            process.env.TESTPLANE_CLI_SOCKET_OVERRIDE = override;
            const paths = socketPathFor("/anywhere");
            expect(paths.socket).toBe(override);
            expect(paths.dir).toBe(tmpRoot);
            expect(paths.log).toBe(path.join(tmpRoot, "custom.log"));
        });
    });
});
