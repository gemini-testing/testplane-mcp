import { WdioBrowser } from "testplane";
import { launchBrowser } from "testplane/unstable";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

import { findElement, LocatorStrategy } from "../../../src/tools/utils/element-selector";
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
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "role",
                    queryValue: "button",
                    queryOptions: { name: "Submit Form" },
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('role "button" with name "Submit Form"');
                expect(result.testplaneCode).toContain('await browser.findByRole("button", {"name":"Submit Form"})');
            });

            it("should find link by role with name", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "role",
                    queryValue: "link",
                    queryOptions: { name: "Home" },
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('role "link" with name "Home"');
                expect(result.testplaneCode).toContain('browser.findByRole("link"');
            });

            it("should find heading by role with level", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "role",
                    queryValue: "heading",
                    queryOptions: { level: 3, name: "Click this heading" },
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('role "heading" with name "Click this heading"');
                expect(result.testplaneCode).toContain(
                    'await browser.findByRole("heading", {"level":3,"name":"Click this heading"})',
                );
            });

            it("should throw error with short message when multiple elements are found", async () => {
                await expect(
                    findElement(browser, {
                        strategy: LocatorStrategy.TestingLibrary,
                        queryType: "role",
                        queryValue: "button",
                    }),
                ).rejects.toThrow('Found multiple elements with the role "button"');
            });
        });

        describe("getByText queries", () => {
            it("should find element by exact text content", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "text",
                    queryValue: "Click here to test text selection",
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('text "Click here to test text selection"');
                expect(result.testplaneCode).toContain('await browser.findByText("Click here to test text selection")');
            });

            it("should find element by partial text with exact: false", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "text",
                    queryValue: "Download",
                    queryOptions: { exact: false },
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('text "Download"');
                expect(result.testplaneCode).toContain('await browser.findByText("Download", {"exact":false})');
            });
        });

        describe("getByLabelText queries", () => {
            it("should find input by label text", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "labelText",
                    queryValue: "Email Address",
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('label text "Email Address"');
                expect(result.testplaneCode).toContain('await browser.findByLabelText("Email Address")');
            });

            it("should find textarea by label text", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "labelText",
                    queryValue: "Message",
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('label text "Message"');
                expect(result.testplaneCode).toContain('await browser.findByLabelText("Message")');
            });
        });

        describe("getByPlaceholderText queries", () => {
            it("should find input by placeholder text", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "placeholderText",
                    queryValue: "Enter your name",
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('placeholder text "Enter your name"');
                expect(result.testplaneCode).toContain('await browser.findByPlaceholderText("Enter your name")');
            });

            it("should find textarea by placeholder text", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "placeholderText",
                    queryValue: "Type your feedback here...",
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('placeholder text "Type your feedback here..."');
                expect(result.testplaneCode).toContain(
                    'await browser.findByPlaceholderText("Type your feedback here...")',
                );
            });
        });

        describe("getByAltText queries", () => {
            it("should find image by alt text", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "altText",
                    queryValue: "Company Logo",
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('alt text "Company Logo"');
                expect(result.testplaneCode).toContain('await browser.findByAltText("Company Logo")');
            });

            it("should find another image by alt text", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "altText",
                    queryValue: "Success icon",
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('alt text "Success icon"');
                expect(result.testplaneCode).toContain('await browser.findByAltText("Success icon")');
            });
        });

        describe("getByTestId queries", () => {
            it("should find element by test id", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "testId",
                    queryValue: "action-button",
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('test ID "action-button"');
                expect(result.testplaneCode).toContain('await browser.findByTestId("action-button")');
            });

            it("should find container by test id", async () => {
                const result = await findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "testId",
                    queryValue: "widget-container",
                });

                expect(result.element).toBeDefined();
                expect(result.queryDescription).toBe('test ID "widget-container"');
                expect(result.testplaneCode).toContain('await browser.findByTestId("widget-container")');
            });
        });
    });

    describe("CSS selector fallback", () => {
        it("should find element by CSS class selector", async () => {
            const result = await findElement(browser, {
                strategy: LocatorStrategy.Wdio,
                selector: ".custom-class-btn",
            });

            expect(result.element).toBeDefined();
            expect(result.queryDescription).toBe('CSS selector ".custom-class-btn"');
            expect(result.testplaneCode).toContain('browser.$(".custom-class-btn")');
        });

        it("should find element by ID selector", async () => {
            const result = await findElement(browser, {
                strategy: LocatorStrategy.Wdio,
                selector: "#unique-element",
            });

            expect(result.element).toBeDefined();
            expect(result.queryDescription).toBe('CSS selector "#unique-element"');
            expect(result.testplaneCode).toContain('browser.$("#unique-element")');
        });

        it("should find element by complex CSS selector", async () => {
            const result = await findElement(browser, {
                strategy: LocatorStrategy.Wdio,
                selector: "button.success-btn",
            });

            expect(result.element).toBeDefined();
            expect(result.queryDescription).toBe('CSS selector "button.success-btn"');
            expect(result.testplaneCode).toContain('browser.$("button.success-btn")');
        });
    });

    describe("error handling", () => {
        it("should reject when invalid strategy is provided", async () => {
            await expect(
                findElement(
                    browser,
                    {
                        strategy: "invalid-strategy",
                        queryType: "role",
                        queryValue: "button",
                    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
                ),
            ).rejects.toThrow(/Provided locator.strategy is not supported/);
        });

        it("should reject when neither semantic query nor selector is provided", async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await expect(findElement(browser, {} as any)).rejects.toThrow(/Provided locator.strategy is not supported/);
        });

        it("should handle element not found gracefully", async () => {
            await expect(
                findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "role",
                    queryValue: "button",
                    queryOptions: { name: "Non-existent Button" },
                }),
            ).rejects.toThrow("Unable to find element");
        });

        it("should handle invalid CSS selector gracefully", async () => {
            const result = await findElement(browser, {
                strategy: LocatorStrategy.Wdio,
                selector: ".non-existent-class",
            });

            expect(result.element).toBeDefined();
            expect((result.element as any).error).toBeDefined(); // eslint-disable-line @typescript-eslint/no-explicit-any
            expect((result.element as any).error.error).toBe("no such element"); // eslint-disable-line @typescript-eslint/no-explicit-any
        });

        it("should reject unsupported queryType", async () => {
            await expect(
                findElement(browser, {
                    strategy: LocatorStrategy.TestingLibrary,
                    queryType: "invalidType" as "role",
                    queryValue: "button",
                }),
            ).rejects.toThrow("Unsupported queryType");
        });
    });
});
