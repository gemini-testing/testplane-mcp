import { z } from "zod";
import { launchBrowser as launchTestplaneBrowser } from "testplane/unstable";
import { BrowserOptions, SessionOpenTool, ToolKind } from "../types.js";
import { createSimpleResponse, createErrorResponse } from "../responses/index.js";
import { getSandboxArgs, mergeSandboxArgs } from "../utils/sandbox-args.js";

const desiredCapabilitiesSchema = z
    .object({})
    .catchall(z.unknown())
    .superRefine((value, ctx) => {
        const browserName = value?.["browserName"];

        if (browserName !== undefined && typeof browserName !== "string") {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: '"browserName" must be a string' });
        }
    })
    .describe(
        'WebDriver desiredCapabilities that should be used when launching the browser. Example to launch Chrome with mobile emulation: {"browserName":"chrome","goog:chromeOptions":{"mobileEmulation":{"deviceMetrics":{"width":360,"height":800,"pixelRatio":1.0}}}}',
    );

const windowSizeSchema = z
    .union([
        z
            .object({
                width: z.number().int().positive(),
                height: z.number().int().positive(),
            })
            .strict(),
        z
            .string()
            .trim()
            .regex(/^[0-9]+x[0-9]+$/, {
                message: '"windowSize" should use the format "<width>x<height>" (e.g. "1600x900")',
            }),
        z.null(),
    ])
    .optional()
    .describe(
        'Viewport to use for the session. Provide {"width": number, "height": number} or a string like "1280x720"; use null to reset to the default size.',
    );

export const launchBrowserSchema = {
    headless: z
        .boolean()
        .optional()
        .describe(
            'Whether to run browser in headless mode. When omitted, preserves the current session mode (CLI defaults to headless on first launch; use "--headless false" for headful mode).',
        ),
    desiredCapabilities: desiredCapabilitiesSchema.optional(),
    gridUrl: z
        .string()
        .default("local")
        .describe(
            'WebDriver endpoint to connect to. "local" (default) lets Testplane manage Chrome and Firefox automatically; set a Selenium grid URL only when you need other browsers.',
        ),
    windowSize: windowSizeSchema,
};

const launchBrowserCb: SessionOpenTool<typeof launchBrowserSchema>["cb"] = async (args, previousOptions) => {
    try {
        const headless = args.headless;
        const desiredCapabilities = args.desiredCapabilities as BrowserOptions["desiredCapabilities"];
        const gridUrl = args.gridUrl ?? "local";
        const windowSizeInput = args.windowSize;

        const updatedOptions: BrowserOptions = { ...previousOptions };

        if (Object.prototype.hasOwnProperty.call(args, "headless")) {
            updatedOptions.headless = headless;
        }

        if (Object.prototype.hasOwnProperty.call(args, "desiredCapabilities")) {
            updatedOptions.desiredCapabilities = desiredCapabilities;
        }

        if (!gridUrl || gridUrl === "local") {
            delete updatedOptions.gridUrl;
        } else {
            updatedOptions.gridUrl = gridUrl;
        }

        if (Object.prototype.hasOwnProperty.call(args, "windowSize")) {
            if (windowSizeInput === null) {
                updatedOptions.windowSize = null;
            } else if (typeof windowSizeInput === "string") {
                const [width, height] = windowSizeInput.split("x").map(value => Number.parseInt(value, 10));
                updatedOptions.windowSize = { width, height };
            } else if (windowSizeInput === undefined) {
                delete updatedOptions.windowSize;
            } else {
                updatedOptions.windowSize = windowSizeInput as BrowserOptions["windowSize"];
            }
        }

        const sandboxArgs = getSandboxArgs();
        const mergedCapabilities = mergeSandboxArgs(updatedOptions.desiredCapabilities, sandboxArgs);

        console.error("Launch browser");
        const browser = await launchTestplaneBrowser({
            headless: updatedOptions.headless ? "new" : false,
            desiredCapabilities: mergedCapabilities,
            gridUrl: updatedOptions.gridUrl,
            windowSize: updatedOptions.windowSize,
        });

        return {
            browser,
            options: updatedOptions,
            transport: "launch-browser" as const,
            response: createSimpleResponse("Successfully launched browser session"),
        };
    } catch (error) {
        console.error("Error launching browser:", error);
        return {
            browser: null,
            options: previousOptions,
            response: createErrorResponse("Error launching browser", error instanceof Error ? error : undefined),
        };
    }
};

export const launchBrowser: SessionOpenTool<typeof launchBrowserSchema> = {
    kind: ToolKind.SessionOpen,
    name: "launch",
    description:
        "Launch a new browser session with custom desired capabilities. Avoid using this tool unless the user explicitly requests a custom browser configuration; browsers are launched automatically for commands like navigate to URL. Testplane can ONLY download Chrome and Firefox automatically, for other browsers you MUST ensure that driver is launched and provide it as custom gridUrl.",
    schema: launchBrowserSchema,
    cb: launchBrowserCb,
    cli: { section: "Session" },
};

// Convenience factory used by MCP's wrapper to launch a default browser without routing through the tool.
export async function launchBrowserWithOptions(options: BrowserOptions) {
    const sandboxArgs = getSandboxArgs();
    const mergedCapabilities = mergeSandboxArgs(options.desiredCapabilities, sandboxArgs);

    return launchTestplaneBrowser({
        headless: options.headless ? "new" : false,
        desiredCapabilities: mergedCapabilities,
        gridUrl: options.gridUrl,
        windowSize: options.windowSize,
    });
}
