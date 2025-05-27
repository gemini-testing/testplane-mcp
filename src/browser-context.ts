import { WdioBrowser } from "testplane";
import { launchBrowser } from "testplane/unstable";

export interface BrowserOptions {
    headless?: boolean;
}

export class BrowserContext {
    protected _browser: WdioBrowser | null = null;
    protected _options: BrowserOptions;

    constructor(options: BrowserOptions = {}) {
        this._options = options;
    }

    async get(): Promise<WdioBrowser> {
        if (this._browser) {
            return this._browser;
        }

        this._browser = await launchBrowser({
            headless: this._options.headless ? "new" : false,
            desiredCapabilities: {
                "goog:chromeOptions": {
                    args: process.env.DISABLE_BROWSER_SANDBOX ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
                },
            },
        });

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
