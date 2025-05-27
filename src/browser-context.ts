import { WdioBrowser } from "testplane";
import { launchBrowser } from "testplane/unstable";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

export interface BrowserOptions {
    headless?: boolean;
}

export class BrowserContext {
    protected _browser: WdioBrowser | null = null;
    protected _options: BrowserOptions;
    protected _userDataDir: string;

    constructor(options: BrowserOptions = {}) {
        this._options = options;
        this._userDataDir = join(tmpdir(), `testplane-mcp-${randomUUID()}`);
    }

    async get(): Promise<WdioBrowser> {
        if (this._browser) {
            return this._browser;
        }

        this._browser = await launchBrowser({
            headless: this._options.headless ? "new" : false,
            desiredCapabilities: {
                browserName: "chrome",
                "goog:chromeOptions": {
                    args: [`--user-data-dir=${this._userDataDir}`],
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
