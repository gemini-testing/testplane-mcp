import { z } from "zod";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { launchBrowser, launchBrowserSchema } from "../../src/tools/launch-browser.js";
import { launchBrowser as launchTestplaneBrowser } from "testplane/unstable";

vi.mock("testplane/unstable", () => ({
    launchBrowser: vi.fn(),
}));

describe("tools/launchBrowser headless option", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(launchTestplaneBrowser).mockResolvedValue({} as never);
    });

    it("preserves previous session mode when headless is omitted", async () => {
        const parsedArgs = z.object(launchBrowserSchema).parse({});
        const result = await launchBrowser.cb(parsedArgs, { headless: false });

        expect(result.options.headless).toBe(false);
        expect(vi.mocked(launchTestplaneBrowser)).toHaveBeenCalledWith(
            expect.objectContaining({
                headless: false,
            }),
        );
    });

    it("allows explicitly enabling headless mode", async () => {
        const parsedArgs = z.object(launchBrowserSchema).parse({ headless: true });
        const result = await launchBrowser.cb(parsedArgs, { headless: false });

        expect(result.options.headless).toBe(true);
        expect(vi.mocked(launchTestplaneBrowser)).toHaveBeenCalledWith(
            expect.objectContaining({
                headless: "new",
            }),
        );
    });

    it("allows explicitly disabling headless mode", async () => {
        const parsedArgs = z.object(launchBrowserSchema).parse({ headless: false });
        const result = await launchBrowser.cb(parsedArgs, { headless: true });

        expect(result.options.headless).toBe(false);
        expect(vi.mocked(launchTestplaneBrowser)).toHaveBeenCalledWith(
            expect.objectContaining({
                headless: false,
            }),
        );
    });
});
