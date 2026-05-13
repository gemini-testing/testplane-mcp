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
    INLINE_SNAPSHOT_MAX_LENGTH: 32_000,
    convertSnapshotToResponse: vi.fn(),
    getBrowserTabs: vi.fn(),
    getPageSnapshot: vi.fn(),
    isPageSnapshotTooLargeForInline: vi.fn((snapshot: { content: string }) => snapshot.content.length > 32_000),
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
        let mockConvertSnapshotToResponse: ReturnType<typeof vi.fn>;
        let mockGetBrowserTabs: ReturnType<typeof vi.fn>;
        let mockGetPageSnapshot: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            mockBrowser = {} as WdioBrowser;
            mockConvertSnapshotToResponse = vi.mocked(browserHelpers.convertSnapshotToResponse);
            mockGetBrowserTabs = vi.mocked(browserHelpers.getBrowserTabs);
            mockGetPageSnapshot = vi.mocked(browserHelpers.getPageSnapshot);
            mockGetBrowserTabs.mockResolvedValue([]);
            mockGetPageSnapshot.mockResolvedValue(null);
            mockConvertSnapshotToResponse.mockResolvedValue(
                "The snapshot was saved to: /tmp/.testplane/snapshots/snap.yml",
            );
        });

        it("should create response with action only", async () => {
            const options: BrowserResponseOptions = {
                action: "Page loaded successfully",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);

            expect(result.content[0].text).toContain("✅ Page loaded successfully");
            expect(result.isError).toBe(false);
        });

        it("should include testplane code when provided", async () => {
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

            const options: BrowserResponseOptions = {
                action: "Navigation completed",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(responseText).toContain("## Browser Tabs");
            expect(responseText).toContain("1. Title: Google; URL: https://google.com (current)");
            expect(responseText).toContain("2. Title: GitHub; URL: https://github.com");
        });

        it("should save snapshot to file by default and include path in response", async () => {
            const snapshot = {
                content: "Snapshot content",
                fenceLanguage: "yaml" as const,
            };
            mockGetPageSnapshot.mockResolvedValue(snapshot);
            mockConvertSnapshotToResponse.mockResolvedValue(
                "The snapshot was saved to: /tmp/.testplane/snapshots/2026-05-04T12-34-56-789Z.yml",
            );

            const options: BrowserResponseOptions = {
                action: "Snapshot saved",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(mockGetPageSnapshot).toHaveBeenCalledOnce();
            expect(mockConvertSnapshotToResponse).toHaveBeenCalledWith(snapshot, { forceSaveToFile: true });
            expect(responseText).toContain("## Current Tab Snapshot");
            expect(responseText).toContain(
                "The snapshot was saved to: /tmp/.testplane/snapshots/2026-05-04T12-34-56-789Z.yml",
            );
            expect(responseText).not.toContain("```yaml");
        });

        it("should show when no snapshot was captured", async () => {
            mockGetPageSnapshot.mockResolvedValue(null);

            const options: BrowserResponseOptions = {
                action: "Snapshot saved",
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(mockGetPageSnapshot).toHaveBeenCalledOnce();
            expect(mockConvertSnapshotToResponse).not.toHaveBeenCalled();
            expect(responseText).toContain("## Current Tab Snapshot");
            expect(responseText).toContain("No snapshot captured");
        });

        it("should inline snapshot when inlineSnapshot is true", async () => {
            const snapshot = {
                content: "<html><body>Test content</body></html>",
                fenceLanguage: "yaml" as const,
            };
            mockGetPageSnapshot.mockResolvedValue(snapshot);
            mockConvertSnapshotToResponse.mockResolvedValue("```yaml\n<html><body>Test content</body></html>\n```");

            const options: BrowserResponseOptions = {
                action: "Snapshot captured",
                inlineSnapshot: true,
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(mockGetPageSnapshot).toHaveBeenCalledOnce();
            expect(mockConvertSnapshotToResponse).toHaveBeenCalledWith(snapshot, { forceSaveToFile: false });
            expect(responseText).toContain("## Current Tab Snapshot");
            expect(responseText).toContain("<html><body>Test content</body></html>");
            expect(responseText).not.toContain("The snapshot was saved to:");
        });

        it("should delegate large inline snapshot handling to snapshot response formatter", async () => {
            const snapshot = {
                content: "x".repeat(32_001),
                fenceLanguage: "yaml" as const,
            };
            mockGetPageSnapshot.mockResolvedValue(snapshot);
            mockConvertSnapshotToResponse.mockResolvedValue(
                "The snapshot is too large to include inline (32001 characters; limit 32000), so it was saved to: /tmp/.testplane/snapshots/large.yml",
            );

            const options: BrowserResponseOptions = {
                action: "Snapshot captured",
                inlineSnapshot: true,
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(mockGetPageSnapshot).toHaveBeenCalledOnce();
            expect(mockConvertSnapshotToResponse).toHaveBeenCalledWith(snapshot, { forceSaveToFile: false });
            expect(responseText).toContain("## Current Tab Snapshot");
            expect(responseText).toContain("The snapshot is too large to include inline");
            expect(responseText).toContain("so it was saved to: /tmp/.testplane/snapshots/large.yml");
            expect(responseText).not.toContain("```yaml");
        });

        it("should skip snapshot when isSnapshotNeeded is false", async () => {
            const options: BrowserResponseOptions = {
                action: "No snapshot wanted",
                isSnapshotNeeded: false,
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(mockGetPageSnapshot).not.toHaveBeenCalled();
            expect(mockConvertSnapshotToResponse).not.toHaveBeenCalled();
            expect(responseText).not.toContain("## Current Tab Snapshot");
        });

        it("should include additional information when provided", async () => {
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
            const snapshot = {
                content: "Snapshot content",
                fenceLanguage: "yaml" as const,
            };
            const mockTabs = [{ title: "Test Page", url: "https://test.com", isActive: true }];
            mockGetBrowserTabs.mockResolvedValue(mockTabs);
            mockGetPageSnapshot.mockResolvedValue(snapshot);
            mockConvertSnapshotToResponse.mockResolvedValue(
                "The snapshot was saved to: /tmp/.testplane/snapshots/snap.yml",
            );

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
            expect(responseText).toContain("The snapshot was saved to: /tmp/.testplane/snapshots/snap.yml");
            expect(responseText).toContain("## Additional Information");
            expect(responseText).toContain("All features tested successfully.");
        });

        it("should handle empty tabs array", async () => {
            const options: BrowserResponseOptions = {
                action: "No tabs test",
                isSnapshotNeeded: false,
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(responseText).toContain("## Browser Tabs");
            expect(responseText).toContain("No opened tabs");
        });

        it("should not include snapshot section when snapshot is disabled", async () => {
            const options: BrowserResponseOptions = {
                action: "No snapshot test",
                isSnapshotNeeded: false,
            };

            const result = await createBrowserStateResponse(mockBrowser, options);
            const responseText = result.content[0].text;

            expect(mockGetPageSnapshot).not.toHaveBeenCalled();
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
