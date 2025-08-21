import { WdioBrowser, SessionOptions } from "testplane";
import { launchBrowser, attachToBrowser } from "testplane/unstable";

export interface BrowserOptions {
    headless?: boolean;
}

export class BrowserContext {
    protected _browser: WdioBrowser | null = null;
    protected _options: BrowserOptions;
    protected _session: SessionOptions | undefined;

    constructor(options: BrowserOptions = {}, session?: SessionOptions) {
        this._options = options;
        this._session = session;
    }

    async get(): Promise<WdioBrowser> {
        if (this._browser) {
            return this._browser;
        }

        if (this._session) {
            console.error("Attach to browser");

            this._browser = await attachToBrowser(this._session);

            // try {
            //     this._browser = await attachToBrowser(this._session);
            //     await this._browser.getUrl();
            //     console.error("Attached to browser successfully");
            // } catch (e) {
            //     console.error("Can't attach to browser", e);
            // }
        } else {
            console.error("Launch browser");
            this._browser = await launchBrowser({
                headless: this._options.headless ? "new" : false,
                desiredCapabilities: {
                    "goog:chromeOptions": {
                        args: process.env.DISABLE_BROWSER_SANDBOX ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
                    },
                },
            });
        }

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

    async isActive(): Promise<boolean> {
        try {
            if (this._browser) {
                await this._browser.getUrl();
                return true;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            /* empty */
        }
        return false;
        // return this._browser !== null;
    }
}
