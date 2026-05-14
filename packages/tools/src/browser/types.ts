export interface CaptureSnapshotOptions {
    includeTags?: string[];
    includeAttrs?: string[];
    excludeTags?: string[];
    excludeAttrs?: string[];
    truncateText?: boolean;
    maxTextLength?: number;
}

export interface CaptureDomSnapshotResult {
    snapshot: string;
    omittedTags: string[];
    omittedAttributes: string[];
    textWasTruncated: boolean;
}

export interface BrowserAdapter {
    getWindowHandles(): Promise<string[]>;
    getWindowHandle(): Promise<string>;
    switchToWindow(handle: string): Promise<void>;
    getTitle(): Promise<string>;
    getUrl(): Promise<string>;
    getPageSource(): Promise<string>;
    unstable_captureDomSnapshot(options?: CaptureSnapshotOptions): Promise<CaptureDomSnapshotResult>;
}

export interface BrowserSession extends BrowserAdapter {
    deleteSession(): Promise<void>;
}
