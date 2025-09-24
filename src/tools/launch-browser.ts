import { z } from "zod";
import { ToolDefinition, Context } from "../types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextProvider } from "../context-provider.js";
import { createSimpleResponse, createErrorResponse } from "../responses/index.js";
import { BrowserContext, type BrowserOptions } from "../browser-context.js";

const desiredCapabilitiesSchema = z
    .object({})
    .catchall(z.unknown())
    .superRefine((value, ctx) => {
        const browserName = value?.["browserName"];

        if (browserName === undefined) {
            return;
        }

        if (typeof browserName !== "string") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: '"browserName" must be a string' });
            return;
        }

        const normalized = browserName.toLowerCase();
        if (normalized !== "chrome" && normalized !== "firefox") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Only "chrome" and "firefox" values are currently supported for "browserName"',
            });
        }
    })
    .describe("WebDriver desiredCapabilities that should be used when launching the browser");

export const launchBrowserSchema = {
    desiredCapabilities: desiredCapabilitiesSchema.optional(),
};

const launchBrowserCb: ToolCallback<typeof launchBrowserSchema> = async args => {
    try {
        const context = contextProvider.getContext();
        const desiredCapabilities = args.desiredCapabilities as BrowserOptions["desiredCapabilities"];

        if (await context.browser.isActive()) {
            console.error("Closing existing browser before launching a new one");
            await context.browser.close();
        }

        const updatedOptions: BrowserOptions = {
            ...context.browser.getOptions(),
        };

        if (Object.prototype.hasOwnProperty.call(args, "desiredCapabilities")) {
            updatedOptions.desiredCapabilities = desiredCapabilities;
        }

        const browserContext = new BrowserContext(updatedOptions);
        const newContext: Context = {
            browser: browserContext,
        };
        contextProvider.setContext(newContext);

        await browserContext.get();

        return createSimpleResponse("Successfully launched browser session");
    } catch (error) {
        console.error("Error launching browser:", error);
        return createErrorResponse("Error launching browser", error instanceof Error ? error : undefined);
    }
};

export const launchBrowser: ToolDefinition<typeof launchBrowserSchema> = {
    name: "launchBrowser",
    description:
        "Launch a new browser session with custom desired capabilities. Avoid using this tool unless the user explicitly requests a custom browser configuration; browsers are launched automatically for commands like navigate to URL. Currently only Chrome and Firefox are supported.",
    schema: launchBrowserSchema,
    cb: launchBrowserCb,
};
