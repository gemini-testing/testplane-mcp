export interface Request {
    id: number;
    kind: "call";
    tool: string;
    sessionName: string;
    args: unknown;
}

export interface ResponseResult {
    id: number;
    kind: "result";
    content: Array<{ type: string; text?: string; [key: string]: unknown }>;
    isError?: boolean;
}

export interface ResponseError {
    id: number;
    kind: "error";
    code: string;
    message: string;
}

export type Response = ResponseResult | ResponseError;
