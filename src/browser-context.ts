import { WdioBrowser } from "testplane";
import { launchBrowser } from "testplane/unstable";

export class BrowserContext {
    protected _browser: WdioBrowser | null = null;

    async get(): Promise<WdioBrowser> {
        if (this._browser) {
            return this._browser;
        }

        this._browser = await launchBrowser({ headless: false });

        return this._browser;
    }

    async close(): Promise<void> {
        if (this._browser) {
            try {
                await this._browser.deleteSession();
                console.error("Browser session closed");
            } catch (error) {
                console.error("Error closing browser session:", error);
            } finally {
                this._browser = null;
            }
        }
    }

    isActive(): boolean {
        return this._browser !== null;
    }
}
