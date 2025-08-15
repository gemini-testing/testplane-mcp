import { z } from "zod";

export const attachToBrowserSchema = {
    session: z
        .object({
            sessionId: z.string().describe("Unique identifier for the session"),
            sessionCaps: z
                .object({
                    acceptInsecureCerts: z
                        .boolean()
                        .describe("Whether the session accepts insecure certificates")
                        .optional(),
                    browserName: z.string().describe("Name of the browser being automated"),
                    browserVersion: z.string().describe("Version of the browser"),
                    chrome: z
                        .object({
                            chromedriverVersion: z.string().describe("Version of ChromeDriver being used"),
                            userDataDir: z.string().describe("Path to Chrome's user data directory"),
                        })
                        .describe("Chrome-specific capabilities")
                        .optional(),
                    "fedcm:accounts": z.boolean().describe("FedCM accounts API support flag").optional(),
                    "goog:chromeOptions": z
                        .object({
                            debuggerAddress: z.string().describe("Address for Chrome debugger"),
                        })
                        .describe("Chrome options")
                        .optional(),
                    networkConnectionEnabled: z.boolean().describe("Network connection capability flag").optional(),
                    pageLoadStrategy: z.string().describe("Strategy for page loading").optional(),
                    platformName: z.string().describe("Name of the platform").optional(),
                    proxy: z.object({}).describe("Proxy configuration").optional(),
                    setWindowRect: z.boolean().describe("Window resizing capability flag"),
                    strictFileInteractability: z.boolean().describe("Strict file interaction flag").optional(),
                    timeouts: z
                        .object({
                            implicit: z.number().describe("Implicit wait timeout in ms"),
                            pageLoad: z.number().describe("Page load timeout in ms"),
                            script: z.number().describe("Script execution timeout in ms"),
                        })
                        .describe("Timeout configurations")
                        .optional(),
                    unhandledPromptBehavior: z.string().describe("Behavior for unhandled prompts").optional(),
                    "webauthn:extension:credBlob": z
                        .boolean()
                        .describe("WebAuthn credBlob extension support")
                        .optional(),
                    "webauthn:extension:largeBlob": z
                        .boolean()
                        .describe("WebAuthn largeBlob extension support")
                        .optional(),
                    "webauthn:extension:minPinLength": z
                        .boolean()
                        .describe("WebAuthn minPinLength extension support")
                        .optional(),
                    "webauthn:extension:prf": z.boolean().describe("WebAuthn prf extension support").optional(),
                    "webauthn:virtualAuthenticators": z.boolean().describe("Virtual authenticators support").optional(),
                })
                .describe("Session capabilities"),
            sessionOpts: z
                .object({
                    protocol: z.string().describe("Protocol used for connection"),
                    hostname: z.string().describe("Hostname for WebDriver server"),
                    port: z.number().describe("Port for WebDriver server"),
                    path: z.string().describe("Base path for WebDriver endpoints"),
                    queryParams: z.object({}).describe("Additional query parameters").optional(),
                    capabilities: z
                        .object({
                            browserName: z.string().describe("Requested browser name"),
                            "wdio:enforceWebDriverClassic": z
                                .boolean()
                                .describe("Flag to enforce classic WebDriver protocol"),
                            "goog:chromeOptions": z
                                .object({
                                    binary: z.string().describe("Path to Chrome binary"),
                                })
                                .describe("Chrome-specific options"),
                        })
                        .describe("Requested capabilities")
                        .optional(),
                    logLevel: z.string().describe("Logging level").optional(),
                    connectionRetryTimeout: z.number().describe("Connection retry timeout in ms").optional(),
                    connectionRetryCount: z.number().describe("Maximum connection retry attempts").optional(),
                    enableDirectConnect: z.boolean().describe("Flag for direct connection to browser").optional(),
                    strictSSL: z.boolean().describe("Strict SSL verification flag"),
                    requestedCapabilities: z
                        .object({
                            browserName: z.string().describe("Originally requested browser name"),
                            "wdio:enforceWebDriverClassic": z
                                .boolean()
                                .describe("Originally requested protocol enforcement"),
                            "goog:chromeOptions": z.object({
                                binary: z.string().describe("Originally requested Chrome binary path"),
                            }),
                        })
                        .describe("Originally requested capabilities")
                        .optional(),
                    automationProtocol: z.string().describe("Automation protocol being used").optional(),
                    baseUrl: z.string().describe("Base URL for tests").optional(),
                    waitforInterval: z.number().describe("Wait interval in ms").optional(),
                    waitforTimeout: z.number().describe("Wait timeout in ms").optional(),
                })
                .describe("Session options")
                .optional(),
        })
        .describe("Attach to browser json object from console after --keep-browser testplane run"),
};
