#!/usr/bin/env node

import { BrowserContext } from "../build/browser-context.js";

async function preloadBrowser() {
    const browserContext = new BrowserContext({ headless: true });
    await browserContext.get();
    await browserContext.close();
}

preloadBrowser();
