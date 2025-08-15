import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";

const sessionMinimalMock = {
    sessionId: "ffe4129f99be1125e304242500121efa",
    sessionCaps: {
        browserName: "chrome",
        browserVersion: "137.0.7151.119",
        setWindowRect: true,
    },
    sessionOpts: {
        protocol: "http",
        hostname: "127.0.0.1",
        port: 49426,
        path: "/",
        strictSSL: true,
    },
};
describe.only(
    "tools/attachToBrowser",
    () => {
        let client: Client;

        beforeEach(async () => {
            client = await startClient();
        });

        afterEach(async () => {
            if (client) {
                await client.close();
            }
        });

        describe("attachToBrowser tool availability", () => {
            it("should list attachToBrowser tool in available tools", async () => {
                const tools = await client.listTools();

                const attachToBrowserTool = tools.tools.find(tool => tool.name === "attachToBrowser");

                expect(attachToBrowserTool).toBeDefined();
                expect(attachToBrowserTool?.description).toBe("Attach to existing browser session");
            });
        });

        describe("attachToBrowser tool execution", () => {
            it("should attach to existing browser session", async () => {
                const result = await client.callTool({
                    name: "attachToBrowser",
                    arguments: {
                        session: sessionMinimalMock,
                    },
                });

                expect(true).toBe(true);

                expect(result.isError).toBe(false);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");
                expect(content[0].text).toBe("Successfully attached to existing browser session");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
