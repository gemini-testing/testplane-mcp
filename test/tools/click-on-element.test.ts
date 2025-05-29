import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { startClient } from "../utils";
import { INTEGRATION_TEST_TIMEOUT } from "../constants";
import { getTestServerUrl, stopTestServer } from "../test-server";

describe(
    "tools/clickOnElement",
    () => {
        let client: Client;
        let playgroundUrl: string;

        beforeAll(async () => {
            playgroundUrl = await getTestServerUrl();
        }, 20000);

        afterAll(async () => {
            await stopTestServer();
        });

        beforeEach(async () => {
            client = await startClient();
            await client.callTool({ name: "navigate", arguments: { url: playgroundUrl } });
        });

        afterEach(async () => {
            if (client) {
                await client.close();
            }
        });

        describe("clickOnElement tool availability", () => {
            it("should list clickOnElement tool in available tools", async () => {
                const tools = await client.listTools();

                const elementClickTool = tools.tools.find(tool => tool.name === "clickOnElement");

                expect(elementClickTool).toBeDefined();
                expect(elementClickTool?.description).toContain("Click an element on the page");
            });
        });

        describe("semantic queries", () => {
            describe("getByRole queries", () => {
                it("should click button by role", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "role",
                            queryValue: "button",
                            queryOptions: { name: "Submit Form" },
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain(
                        'Successfully clicked element found by role "button" with name "Submit Form"',
                    );
                    expect(content[0].text).toContain('browser.getByRole("button"');
                });

                it("should click button by role without name option", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "role",
                            queryValue: "button",
                        },
                    });

                    expect(result.isError).toBe(true);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain('Found multiple elements with the role "button"');
                });

                it("should click link by role", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "role",
                            queryValue: "link",
                            queryOptions: { name: "Home" },
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain(
                        'Successfully clicked element found by role "link" with name "Home"',
                    );
                });

                it("should click heading by role with level", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "role",
                            queryValue: "heading",
                            queryOptions: { level: 3, name: "Click this heading" },
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain('Successfully clicked element found by role "heading"');
                });
            });

            describe("getByText queries", () => {
                it("should click element by text content", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "text",
                            queryValue: "Click here to test text selection",
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain(
                        'Successfully clicked element found by text "Click here to test text selection"',
                    );
                    expect(content[0].text).toContain('browser.getByText("Click here to test text selection"');
                });

                it("should click element by partial text with exact: false", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "text",
                            queryValue: "Download",
                            queryOptions: { exact: false },
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain('Successfully clicked element found by text "Download"');
                });
            });

            describe("getByLabelText queries", () => {
                it("should click input by label text", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "labelText",
                            queryValue: "Email Address",
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain(
                        'Successfully clicked element found by label text "Email Address"',
                    );
                    expect(content[0].text).toContain('browser.getByLabelText("Email Address"');
                });

                it("should click textarea by label text", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "labelText",
                            queryValue: "Message",
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain('Successfully clicked element found by label text "Message"');
                });
            });

            describe("getByPlaceholderText queries", () => {
                it("should click input by placeholder text", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "placeholderText",
                            queryValue: "Enter your name",
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain(
                        'Successfully clicked element found by placeholder text "Enter your name"',
                    );
                    expect(content[0].text).toContain('browser.getByPlaceholderText("Enter your name"');
                });

                it("should click textarea by placeholder text", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "placeholderText",
                            queryValue: "Type your feedback here...",
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain(
                        'Successfully clicked element found by placeholder text "Type your feedback here..."',
                    );
                });
            });

            describe("getByAltText queries", () => {
                it("should click image by alt text", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "altText",
                            queryValue: "Company Logo",
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain('Successfully clicked element found by alt text "Company Logo"');
                    expect(content[0].text).toContain('browser.getByAltText("Company Logo"');
                });

                it("should click another image by alt text", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "altText",
                            queryValue: "Success icon",
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain('Successfully clicked element found by alt text "Success icon"');
                });
            });

            describe("getByTestId queries", () => {
                it("should click element by test id", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "testId",
                            queryValue: "action-button",
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain('Successfully clicked element found by test ID "action-button"');
                    expect(content[0].text).toContain('browser.getByTestId("action-button"');
                });

                it("should click container by test id", async () => {
                    const result = await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "testId",
                            queryValue: "widget-container",
                        },
                    });

                    expect(result.isError).toBe(false);
                    const content = result.content as Array<{ type: string; text: string }>;
                    expect(content[0].text).toContain(
                        'Successfully clicked element found by test ID "widget-container"',
                    );
                });
            });
        });

        describe("CSS selector", () => {
            it("should click element by CSS class selector", async () => {
                const result = await client.callTool({
                    name: "clickOnElement",
                    arguments: {
                        selector: ".custom-class-btn",
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain(
                    'Successfully clicked element found by CSS selector ".custom-class-btn"',
                );
                expect(content[0].text).toContain('browser.$(".custom-class-btn")');
            });

            it("should click element by ID selector", async () => {
                const result = await client.callTool({
                    name: "clickOnElement",
                    arguments: {
                        selector: "#unique-element",
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain(
                    'Successfully clicked element found by CSS selector "#unique-element"',
                );
                expect(content[0].text).toContain('browser.$("#unique-element")');
            });

            it("should click element by complex CSS selector", async () => {
                const result = await client.callTool({
                    name: "clickOnElement",
                    arguments: {
                        selector: "button.success-btn",
                    },
                });

                expect(result.isError).toBe(false);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain(
                    'Successfully clicked element found by CSS selector "button.success-btn"',
                );
            });
        });

        describe("error handling", () => {
            it("should reject when both semantic query and selector are provided", async () => {
                try {
                    await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "role",
                            queryValue: "button",
                            selector: "#some-button",
                        },
                    });
                    expect.fail("Expected the call to fail");
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });

            it("should reject when neither semantic query nor selector is provided", async () => {
                try {
                    await client.callTool({
                        name: "clickOnElement",
                        arguments: {},
                    });
                    expect.fail("Expected the call to fail");
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });

            it("should reject when queryType is provided without queryValue", async () => {
                try {
                    await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "role",
                        },
                    });
                    expect.fail("Expected the call to fail");
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });

            it("should handle element not found gracefully", async () => {
                const result = await client.callTool({
                    name: "clickOnElement",
                    arguments: {
                        queryType: "role",
                        queryValue: "button",
                        queryOptions: { name: "Non-existent Button" },
                    },
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Element not found");
            });

            it("should handle invalid CSS selector gracefully", async () => {
                const result = await client.callTool({
                    name: "clickOnElement",
                    arguments: {
                        selector: ".non-existent-class",
                    },
                });

                expect(result.isError).toBe(true);
                const content = result.content as Array<{ type: string; text: string }>;
                expect(content[0].text).toContain("Error clicking element");
            });

            it("should reject unsupported queryType", async () => {
                try {
                    await client.callTool({
                        name: "clickOnElement",
                        arguments: {
                            queryType: "invalidType" as "role",
                            queryValue: "button",
                        },
                    });
                    expect.fail("Expected the call to fail");
                } catch (error) {
                    expect(error).toBeDefined();
                }
            });
        });
    },
    INTEGRATION_TEST_TIMEOUT,
);
