import type { StandaloneBrowserOptionsInput } from "testplane/unstable";

export const getSandboxArgs = (): string[] =>
    process.env.DISABLE_BROWSER_SANDBOX ? ["--no-sandbox", "--disable-dev-shm-usage", "--disable-web-security"] : [];

export const mergeSandboxArgs = (
    desiredCapabilities: StandaloneBrowserOptionsInput["desiredCapabilities"],
    sandboxArgs: string[],
): StandaloneBrowserOptionsInput["desiredCapabilities"] => {
    if (!sandboxArgs.length) {
        return desiredCapabilities;
    }

    if (!desiredCapabilities) {
        return {
            "goog:chromeOptions": {
                args: sandboxArgs,
            },
        };
    }

    const chromeOptions = desiredCapabilities["goog:chromeOptions"] as Record<string, unknown> | undefined;
    const existingArgs = (chromeOptions?.args as string[]) || [];

    const mergedArgs = [...existingArgs, ...sandboxArgs];
    const uniqueArgs = Array.from(new Set(mergedArgs));

    return {
        ...desiredCapabilities,
        "goog:chromeOptions": {
            ...(chromeOptions || {}),
            args: uniqueArgs,
        },
    };
};
