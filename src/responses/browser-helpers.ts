import { WdioBrowser } from "testplane";

export interface BrowserTab {
    title: string;
    url: string;
    isActive: boolean;
}

export async function getBrowserTabs(browser: WdioBrowser): Promise<BrowserTab[]> {
    try {
        const windowHandles = await browser.getWindowHandles();
        const currentHandle = await browser.getWindowHandle();

        const tabs: BrowserTab[] = [];

        for (const handle of windowHandles) {
            await browser.switchToWindow(handle);
            const title = await browser.getTitle();
            const url = await browser.getUrl();

            tabs.push({
                title: title || "Untitled",
                url: url || "about:blank",
                isActive: handle === currentHandle,
            });
        }

        await browser.switchToWindow(currentHandle);

        return tabs;
    } catch (error) {
        console.error("Error getting browser tabs:", error);
        return [];
    }
}

export async function getCurrentTabSnapshot(browser: WdioBrowser): Promise<string | null> {
    try {
        const pageSource = await browser.getPageSource();

        if (!pageSource || pageSource.trim().length === 0) {
            return null;
        }

        return pageSource;
    } catch (error) {
        console.error("Error getting tab snapshot:", error);
        return null;
    }
}
