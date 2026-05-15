import { attachToBrowser as attachTestplaneBrowser } from "testplane/unstable";
import type { SessionOptions } from "testplane";
import { SessionOpenTool, ToolKind } from "../types.js";
import { createSimpleResponse, createErrorResponse } from "../responses/index.js";
import { attachToBrowserSchema } from "../schemas/attach-to-browser.js";

export { attachToBrowserSchema };

const attachToBrowserCb: SessionOpenTool<typeof attachToBrowserSchema>["cb"] = async (args, previousOptions) => {
    try {
        const { session } = args;

        console.error("Attach to browser");
        const browser = await attachTestplaneBrowser(session as SessionOptions);
        await browser.getUrl(); // verify the attach actually worked

        return {
            browser,
            options: previousOptions,
            response: createSimpleResponse("Successfully attached to existing browser session"),
        };
    } catch (error) {
        console.error("Error attach to browser:", error);
        return {
            browser: null,
            options: previousOptions,
            response: createErrorResponse("Error attach to browser", error instanceof Error ? error : undefined),
        };
    }
};

export const attachToBrowser: SessionOpenTool<typeof attachToBrowserSchema> = {
    kind: ToolKind.SessionOpen,
    name: "attach",
    description: "Attach to existing browser session",
    schema: attachToBrowserSchema,
    cb: attachToBrowserCb,
    cli: { section: "Session" },
};
