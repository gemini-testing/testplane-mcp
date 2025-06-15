import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { PlaygroundServer } from "../test-server";

describe(
    "tools/takePageSnapshot",
    () => {
        let client: Client;
        let playgroundUrl: string;
        let testServer: PlaygroundServer;

        beforeAll(async () => {
            testServer = new PlaygroundServer();
            playgroundUrl = await testServer.start();
        }, 20000);

        afterAll(async () => {
            if (testServer) {
                await testServer.stop();
            }
        });

        beforeEach(async () => {
            client = await startClient();
        });

        afterEach(async () => {
            if (client) {
                await client.close();
            }
        });

        describe("takePageSnapshot tool availability", () => {
            it("should list takePageSnapshot tool in available tools", async () => {
                const tools = await client.listTools();

                const snapshotTool = tools.tools.find(tool => tool.name === "takePageSnapshot");

                expect(snapshotTool).toBeDefined();
            });
        });

        describe("takePageSnapshot tool execution", () => {
            it("should capture snapshot of playground page with expected content", async () => {
                await client.callTool({
                    name: "navigate",
                    arguments: { url: playgroundUrl },
                });

                const result = await client.callTool({
                    name: "takePageSnapshot",
                    arguments: {},
                });

                expect(result.isError).toBe(false);
                expect(result.content).toBeDefined();

                const content = result.content as Array<{ type: string; text: string }>;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe("text");

                const responseText = content[0].text;

                expect(responseText).toContain("Element Click Test Playground");
                expect(responseText).toContain("Role-based Elements");
                expect(responseText).toContain("Submit Form");
                expect(responseText).toContain("Text-based Elements");
                expect(responseText).toContain("Form Elements");
                expect(responseText).toContain("Email Address");
                expect(responseText).toContain("Placeholder Elements");
                expect(responseText).toContain("Enter your name");
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
