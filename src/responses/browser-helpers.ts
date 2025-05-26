import { WdioBrowser } from "testplane";

export interface BrowserTab {
    title: string;
    url: string;
    isActive: boolean;
}

export async function getBrowserTabs(browser: WdioBrowser): Promise<BrowserTab[]> {
    try {
        const puppeteer = await browser.getPuppeteer();
        const pages = await puppeteer.pages();
        const tabs = await Promise.all(
            pages.map(async page => {
                const title = await page.title();
                const url = page.url();
                return {
                    title: title || "Untitled",
                    url: url || "about:blank",
                    isActive: page === pages[0],
                };
            }),
        );
        return tabs;
    } catch (error) {
        console.error("Error getting browser tabs:", error);
        return [];
    }
}

export async function getCurrentTabSnapshot(browser: WdioBrowser): Promise<string | undefined> {
    try {
        const pageSource = await browser.getPageSource();

        if (!pageSource || pageSource.trim().length === 0) {
            return undefined;
        }

        return pageSource;
    } catch (error) {
        console.error("Error getting tab snapshot:", error);
        return undefined;
    }
}
