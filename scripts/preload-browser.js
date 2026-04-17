#!/usr/bin/env node

import { launchBrowser } from "testplane/unstable";

async function preloadBrowser() {
    const browser = await launchBrowser({
        headless: "new",
    });

    await browser.deleteSession();
}

preloadBrowser();
