import fs from "fs/promises";
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

const SAVED_SNAPSHOT_PATH_RE = /Saved to: (\S+\.(?:yml|html))/;

export function extractSnapshotPath(responseText: string): string {
    const match = responseText.match(SAVED_SNAPSHOT_PATH_RE);
    if (!match) throw new Error(`No "Saved to: <path>" line found in response:\n${responseText}`);
    return match[1];
}

export async function readSnapshotFromResponse(responseText: string): Promise<string> {
    return fs.readFile(extractSnapshotPath(responseText), "utf8");
}
