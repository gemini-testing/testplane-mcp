import { WdioBrowser } from "testplane";
import { launchBrowser } from "testplane/unstable";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

import { findElement } from "../../../src/tools/utils/element-selector";
import { PlaygroundServer } from "../../test-server";

describe("tools/utils/element-selector", () => {
    let browser: WdioBrowser;
    let playgroundUrl: string;
    let testServer: PlaygroundServer;

    beforeAll(async () => {
        testServer = new PlaygroundServer();
        playgroundUrl = await testServer.start();
        browser = await launchBrowser({
            headless: "new",
            desiredCapabilities: {
                "goog:chromeOptions": {
                    args: process.env.DISABLE_BROWSER_SANDBOX ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
                },
            },
        });
    }, 20000);

    afterAll(async () => {
        if (browser) {
            await browser.deleteSession();
        }
        if (testServer) {
            await testServer.stop();
        }
    });

    beforeEach(async () => {
        await browser.url(playgroundUrl);
    });

    describe("semantic queries", () => {
        describe("getByRole queries", () => {
            it("should find button by role with name", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "role",
                        queryValue: "button",
                        queryOptions: { name: "Submit Form" },
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('role "button" with name "Submit Form"');
                expect(result.testplaneCode).toContain('browser.getByRole("button"');
                expect(result.testplaneCode).toContain('{"name":"Submit Form"}');
                expect(result.testplaneCode).toContain("await element.click();");
            });

            it("should find link by role with name", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "role",
                        queryValue: "link",
                        queryOptions: { name: "Home" },
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('role "link" with name "Home"');
                expect(result.testplaneCode).toContain('browser.getByRole("link"');
            });

            it("should find heading by role with level", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "role",
                        queryValue: "heading",
                        queryOptions: { level: 3, name: "Click this heading" },
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('role "heading" with name "Click this heading"');
                expect(result.testplaneCode).toContain('browser.getByRole("heading"');
                expect(result.testplaneCode).toContain('"level":3');
            });

            it("should handle role without options", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "role",
                        queryValue: "button",
                        queryOptions: { name: "Submit Form" },
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('role "button" with name "Submit Form"');
                expect(result.testplaneCode).toContain('browser.getByRole("button"');
                expect(result.testplaneCode).toContain('{"name":"Submit Form"}');
            });
        });

        describe("getByText queries", () => {
            it("should find element by exact text content", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "text",
                        queryValue: "Click here to test text selection",
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('text "Click here to test text selection"');
                expect(result.testplaneCode).toContain('browser.getByText("Click here to test text selection")');
            });

            it("should find element by partial text with exact: false", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "text",
                        queryValue: "Download",
                        queryOptions: { exact: false },
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('text "Download"');
                expect(result.testplaneCode).toContain('browser.getByText("Download"');
                expect(result.testplaneCode).toContain('"exact":false');
            });
        });

        describe("getByLabelText queries", () => {
            it("should find input by label text", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "labelText",
                        queryValue: "Email Address",
                    },
                    "await element.setValue('test');",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('label text "Email Address"');
                expect(result.testplaneCode).toContain('browser.getByLabelText("Email Address")');
            });

            it("should find textarea by label text", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "labelText",
                        queryValue: "Message",
                    },
                    "await element.setValue('test');",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('label text "Message"');
                expect(result.testplaneCode).toContain('browser.getByLabelText("Message")');
            });
        });

        describe("getByPlaceholderText queries", () => {
            it("should find input by placeholder text", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "placeholderText",
                        queryValue: "Enter your name",
                    },
                    "await element.setValue('test');",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('placeholder text "Enter your name"');
                expect(result.testplaneCode).toContain('browser.getByPlaceholderText("Enter your name")');
            });

            it("should find textarea by placeholder text", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "placeholderText",
                        queryValue: "Type your feedback here...",
                    },
                    "await element.setValue('test');",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('placeholder text "Type your feedback here..."');
                expect(result.testplaneCode).toContain('browser.getByPlaceholderText("Type your feedback here...")');
            });
        });

        describe("getByAltText queries", () => {
            it("should find image by alt text", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "altText",
                        queryValue: "Company Logo",
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('alt text "Company Logo"');
                expect(result.testplaneCode).toContain('browser.getByAltText("Company Logo")');
            });

            it("should find another image by alt text", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "altText",
                        queryValue: "Success icon",
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('alt text "Success icon"');
                expect(result.testplaneCode).toContain('browser.getByAltText("Success icon")');
            });
        });

        describe("getByTestId queries", () => {
            it("should find element by test id", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "testId",
                        queryValue: "action-button",
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('test ID "action-button"');
                expect(result.testplaneCode).toContain('browser.getByTestId("action-button")');
            });

            it("should find container by test id", async () => {
                const result = await findElement(
                    browser,
                    {
                        queryType: "testId",
                        queryValue: "widget-container",
                    },
                    "await element.click();",
                );

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('test ID "widget-container"');
                expect(result.testplaneCode).toContain('browser.getByTestId("widget-container")');
            });
        });
    });

    describe("CSS selector fallback", () => {
        it("should find element by CSS class selector", async () => {
            const result = await findElement(
                browser,
                {
                    selector: ".custom-class-btn",
                },
                "await element.click();",
            );

            expect(result.element).toBeDefined();
            expect(result.queryDescription).toBe('CSS selector ".custom-class-btn"');
            expect(result.testplaneCode).toContain('browser.$(".custom-class-btn")');
        });

        it("should find element by ID selector", async () => {
            const result = await findElement(
                browser,
                {
                    selector: "#unique-element",
                },
                "await element.click();",
            );

            expect(result.element).toBeDefined();
            expect(result.queryDescription).toBe('CSS selector "#unique-element"');
            expect(result.testplaneCode).toContain('browser.$("#unique-element")');
        });

        it("should find element by complex CSS selector", async () => {
            const result = await findElement(
                browser,
                {
                    selector: "button.success-btn",
                },
                "await element.click();",
            );

            expect(result.element).toBeDefined();
            expect(result.queryDescription).toBe('CSS selector "button.success-btn"');
            expect(result.testplaneCode).toContain('browser.$("button.success-btn")');
        });
    });

    describe("error handling", () => {
        it("should reject when both semantic query and selector are provided", async () => {
            await expect(
                findElement(
                    browser,
                    {
                        queryType: "role",
                        queryValue: "button",
                        selector: "#some-button",
                    },
                    "await element.click();",
                ),
            ).rejects.toThrow("Provide EITHER semantic query");
        });

        it("should reject when neither semantic query nor selector is provided", async () => {
            await expect(findElement(browser, {}, "await element.click();")).rejects.toThrow(
                "Provide either semantic query",
            );
        });

        it("should handle element not found gracefully", async () => {
            await expect(
                findElement(
                    browser,
                    {
                        queryType: "role",
                        queryValue: "button",
                        queryOptions: { name: "Non-existent Button" },
                    },
                    "await element.click();",
                ),
            ).rejects.toThrow("Unable to find an accessible element");
        });

        it("should handle invalid CSS selector gracefully", async () => {
            const result = await findElement(
                browser,
                {
                    selector: ".non-existent-class",
                },
                "await element.click();",
            );

            expect(result.element).toBeDefined();
            expect((result.element as any).error).toBeDefined(); // eslint-disable-line @typescript-eslint/no-explicit-any
            expect((result.element as any).error.error).toBe("no such element"); // eslint-disable-line @typescript-eslint/no-explicit-any
        });

        it("should reject unsupported queryType", async () => {
            await expect(
                findElement(
                    browser,
                    {
                        queryType: "invalidType" as "role",
                        queryValue: "button",
                    },
                    "await element.click();",
                ),
            ).rejects.toThrow("Unsupported queryType");
        });
    });
});
