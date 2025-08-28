import { z } from "zod";

export const attachToBrowserSchema = {
    session: z
        .object({
            sessionId: z.string().describe("Unique identifier for the session"),
            driverPid: z
                .number()
                .describe(
                    "Pid of webdriver process, need for close browser correct, necessarily provide it if it exist",
                )
                .default(0),
            sessionCaps: z
                .object({
                    browserName: z.string().describe("Name of the browser being automated"),
                    browserVersion: z.string().describe("Version of the browser"),
                    setWindowRect: z.boolean().describe("Window resizing capability flag"),
                })
                .describe("Session capabilities"),
            sessionOpts: z
                .object({
                    protocol: z.string().describe("Protocol used for connection"),
                    hostname: z.string().describe("Hostname for WebDriver server"),
                    port: z.number().describe("Port for WebDriver server"),
                    path: z.string().describe("Base path for WebDriver endpoints"),
                })
                .describe("Session options"),
        })
        .describe("Attach to browser json object from console after --keep-browser testplane run"),
};
