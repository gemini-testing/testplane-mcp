import { WdioBrowser } from "testplane";
import { launchBrowser } from "testplane/unstable";

export async function launchHeadlessBrowser(): Promise<WdioBrowser> {
    return launchBrowser({
        headless: "new",
        desiredCapabilities: {
            "goog:chromeOptions": {
                args: process.env.DISABLE_BROWSER_SANDBOX ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
            },
        },
    });
}

export function getTextContent(result: { content: unknown }): string {
    const content = result.content as Array<{ type: string; text: string }>;
    return content.map(item => item.text).join("\n");
}
