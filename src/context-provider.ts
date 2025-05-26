import { Context } from "./types.js";

class ContextProvider {
    private context: Context | null = null;

    setContext(context: Context): void {
        this.context = context;
    }

    getContext(): Context {
        if (!this.context) {
            throw new Error("Context is not available");
        }
        return this.context;
    }

    clearContext(): void {
        this.context = null;
    }
}

export const contextProvider = new ContextProvider();
