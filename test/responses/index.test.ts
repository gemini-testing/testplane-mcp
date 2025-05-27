import { describe, it, expect, vi, beforeEach } from "vitest";
import { WdioBrowser } from "testplane";
import {
    createSimpleResponse,
    createBrowserStateResponse,
    createErrorResponse,
    BrowserResponseOptions,
} from "../../src/responses/index.js";
import * as browserHelpers from "../../src/responses/browser-helpers.js";

vi.mock("../../src/responses/browser-helpers.js", () => ({
    getBrowserTabs: vi.fn(),
    getCurrentTabSnapshot: vi.fn(),
}));

describe("responses/index", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createSimpleResponse", () => {
        it("should create a simple success response", () => {
            const message = "Operation successful";
            const result = createSimpleResponse(message);

            expect(result).toEqual({
                content: [
                    {
                        type: "text",
                        text: message,
                    },
                ],
                isError: false,
            });
        });

        it("should create a simple error response when isError is true", () => {
            const message = "Operation failed";
            const result = createSimpleResponse(message, true);

            expect(result).toEqual({
                content: [
                    {
                        type: "text",
                        text: message,
                    },
                ],
                isError: true,
            });
        });

        it("should default isError to false when not provided", () => {
            const message = "Default behavior";
            const result = createSimpleResponse(message);

            expect(result.isError).toBe(false);
        });
    });

    describe("createBrowserStateResponse", () => {
        let mockBrowser: WdioBrowser;
        let mockGetBrowserTabs: ReturnType<typeof vi.fn>;
        let mockGetCurrentTabSnapshot: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            mockBrowser = {} as WdioBrowser;
            mockGetBrowserTabs = vi.mocked(browserHelpers.getBrowserTabs);
            mockGetCurrentTabSnapshot = vi.mocked(browserHelpers.getCurrentTabSnapshot);
        });

        it("should create response with action only", async () => {
            mockGetBrowserTabs.mockResolvedValue([]);
            mockGetCurrentTabSnapshot.mockResolvedValue(null);

            const options: BrowserResponseOptions = {
                action: "Page loaded successfully",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);

            expect(result.content[0].text).toContain("✅ Page loaded successfully");
            expect(result.isError).toBe(false);
        });

        it("should include testplane code when provided", async () => {
            mockGetBrowserTabs.mockResolvedValue([]);
            mockGetCurrentTabSnapshot.mockResolvedValue(null);

            const options: BrowserResponseOptions = {
                action: "Click performed",
                testplaneCode: 'await browser.click("#submit-button");',
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(responseText).toContain("✅ Click performed");
            expect(responseText).toContain("## Testplane Code");
            expect(responseText).toContain("```javascript");
            expect(responseText).toContain('await browser.click("#submit-button");');
            expect(responseText).toContain("```");
        });

        it("should include browser tabs when available", async () => {
            const mockTabs = [
                { title: "Google", url: "https://google.com", isActive: true },
                { title: "GitHub", url: "https://github.com", isActive: false },
            ];
            mockGetBrowserTabs.mockResolvedValue(mockTabs);
            mockGetCurrentTabSnapshot.mockResolvedValue(null);

            const options: BrowserResponseOptions = {
                action: "Navigation completed",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(responseText).toContain("## Browser Tabs");
            expect(responseText).toContain("1. Title: Google; URL: https://google.com (current)");
            expect(responseText).toContain("2. Title: GitHub; URL: https://github.com");
        });

        it("should include current tab snapshot when available", async () => {
            mockGetBrowserTabs.mockResolvedValue([]);
            mockGetCurrentTabSnapshot.mockResolvedValue("<html><body>Test content</body></html>");

            const options: BrowserResponseOptions = {
                action: "Snapshot captured",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(responseText).toContain("## Current Tab Snapshot");
            expect(responseText).toContain("```html");
            expect(responseText).toContain("<html><body>Test content</body></html>");
            expect(responseText).toContain("```");
        });

        it("should include additional information when provided", async () => {
            mockGetBrowserTabs.mockResolvedValue([]);
            mockGetCurrentTabSnapshot.mockResolvedValue(null);

            const options: BrowserResponseOptions = {
                action: "Complex operation",
                additionalInfo: "This operation involved multiple steps and validations.",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(responseText).toContain("## Additional Information");
            expect(responseText).toContain("This operation involved multiple steps and validations.");
        });

        it("should include all sections when all options are provided", async () => {
            const mockTabs = [{ title: "Test Page", url: "https://test.com", isActive: true }];
            mockGetBrowserTabs.mockResolvedValue(mockTabs);
            mockGetCurrentTabSnapshot.mockResolvedValue("<html><body>Full test</body></html>");

            const options: BrowserResponseOptions = {
                action: "Complete operation",
                testplaneCode: 'await browser.waitForElement("#element");',
                additionalInfo: "All features tested successfully.",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(responseText).toContain("✅ Complete operation");
            expect(responseText).toContain("## Testplane Code");
            expect(responseText).toContain('await browser.waitForElement("#element");');
            expect(responseText).toContain("## Browser Tabs");
            expect(responseText).toContain("1. Title: Test Page; URL: https://test.com (current)");
            expect(responseText).toContain("## Current Tab Snapshot");
            expect(responseText).toContain("<html><body>Full test</body></html>");
            expect(responseText).toContain("## Additional Information");
            expect(responseText).toContain("All features tested successfully.");
        });

        it("should handle empty tabs array", async () => {
            mockGetBrowserTabs.mockResolvedValue([]);
            mockGetCurrentTabSnapshot.mockResolvedValue(null);

            const options: BrowserResponseOptions = {
                action: "No tabs test",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(responseText).not.toContain("## Browser Tabs");
            expect(responseText).toContain("✅ No tabs test");
        });

        it("should handle null snapshot", async () => {
            mockGetBrowserTabs.mockResolvedValue([]);
            mockGetCurrentTabSnapshot.mockResolvedValue(null);

            const options: BrowserResponseOptions = {
                action: "No snapshot test",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(responseText).not.toContain("## Current Tab Snapshot");
            expect(responseText).toContain("✅ No snapshot test");
        });
    });

    describe("createErrorResponse", () => {
        it("should create error response with message only", () => {
            const message = "Something went wrong";
            const result = createErrorResponse(message);

            expect(result).toEqual({
                content: [
                    {
                        type: "text",
                        text: "❌ Something went wrong",
                    },
                ],
                isError: true,
            });
        });

        it("should create error response with message and error object", () => {
            const message = "Operation failed";
            const error = new Error("Network timeout");
            const result = createErrorResponse(message, error);

            expect(result).toEqual({
                content: [
                    {
                        type: "text",
                        text: "❌ Operation failed: Network timeout",
                    },
                ],
                isError: true,
            });
        });

        it("should handle error with empty message", () => {
            const message = "Database error";
            const error = new Error("");
            const result = createErrorResponse(message, error);

            expect(result.content[0].text).toBe("❌ Database error: ");
            expect(result.isError).toBe(true);
        });

        it("should always set isError to true", () => {
            const result1 = createErrorResponse("Error 1");
            const result2 = createErrorResponse("Error 2", new Error("Details"));

            expect(result1.isError).toBe(true);
            expect(result2.isError).toBe(true);
        });
    });
});
