import { z, type ZodTypeAny } from "zod";
import { Command, Option } from "commander";

export type ZodFieldKind = "string" | "number" | "boolean" | "enum" | "stringArray" | "json";

export interface ZodFieldMeta {
    kind: ZodFieldKind;
    optional: boolean;
    defaultValue: unknown;
    description: string;
    enumValues?: readonly string[];
}

function unwrap(schema: ZodTypeAny): { inner: ZodTypeAny; optional: boolean; defaultValue: unknown } {
    let inner: ZodTypeAny = schema;
    let optional = false;
    let defaultValue: unknown = undefined;
    // Walk wrappers: ZodOptional / ZodDefault / ZodNullable / ZodEffects.
    while (true) {
        if (inner instanceof z.ZodOptional) {
            optional = true;
            inner = inner._def.innerType as ZodTypeAny;
            continue;
        }
        if (inner instanceof z.ZodDefault) {
            optional = true;
            defaultValue = inner._def.defaultValue();
            inner = inner._def.innerType as ZodTypeAny;
            continue;
        }
        if (inner instanceof z.ZodNullable) {
            inner = inner._def.innerType as ZodTypeAny;
            continue;
        }
        if (inner instanceof z.ZodEffects) {
            inner = inner._def.schema as ZodTypeAny;
            continue;
        }
        break;
    }
    return { inner, optional, defaultValue };
}

export function describeZodField(schema: ZodTypeAny): ZodFieldMeta {
    const { inner, optional, defaultValue } = unwrap(schema);
    const description = (schema.description ?? inner.description ?? "").trim();

    if (inner instanceof z.ZodString) {
        return { kind: "string", optional, defaultValue, description };
    }
    if (inner instanceof z.ZodNumber) {
        return { kind: "number", optional, defaultValue, description };
    }
    if (inner instanceof z.ZodBoolean) {
        return { kind: "boolean", optional, defaultValue, description };
    }
    if (inner instanceof z.ZodEnum) {
        return {
            kind: "enum",
            optional,
            defaultValue,
            description,
            enumValues: inner._def.values as readonly string[],
        };
    }
    if (inner instanceof z.ZodArray) {
        const { inner: elem } = unwrap(inner._def.type as ZodTypeAny);
        if (elem instanceof z.ZodString || elem instanceof z.ZodEnum) {
            return { kind: "stringArray", optional, defaultValue, description };
        }
        return { kind: "json", optional, defaultValue, description };
    }
    // Objects, unions, records, literals, unknowns → JSON.
    return { kind: "json", optional, defaultValue, description };
}

export function kebabCase(name: string): string {
    return name.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`).replace(/^-/, "");
}

export function parseFromString(raw: string, meta: ZodFieldMeta): unknown {
    switch (meta.kind) {
        case "number": {
            const n = Number(raw);
            if (Number.isNaN(n)) {
                throw new Error(`expected number, got "${raw}"`);
            }

            return n;
        }
        case "boolean": {
            if (raw === "true" || raw === "1") {
                return true;
            }
            if (raw === "false" || raw === "0") {
                return false;
            }
            throw new Error(`expected boolean ("true" or "false"), got "${raw}"`);
        }
        case "json": {
            try {
                return JSON.parse(raw);
            } catch (err) {
                throw new Error(`expected JSON: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        case "stringArray":
            return [raw];
        case "string":
        case "enum":
        default:
            return raw;
    }
}

export function registerFlag(cmd: Command, name: string, meta: ZodFieldMeta): void {
    const flag = `--${kebabCase(name)}`;
    const desc = meta.description || "(no description)";

    let opt: Option;
    switch (meta.kind) {
        case "boolean":
            opt = new Option(meta.defaultValue === true ? `--no-${kebabCase(name)}` : flag, desc);
            break;
        case "number":
            opt = new Option(`${flag} <value>`, desc).argParser(raw => {
                const n = Number(raw);
                if (Number.isNaN(n)) {
                    throw new Error(`${flag} must be a number, got "${raw}"`);
                }
                return n;
            });
            break;
        case "enum":
            opt = new Option(`${flag} <value>`, desc);
            if (meta.enumValues) {
                opt.choices([...meta.enumValues]);
            }
            break;
        case "stringArray":
            opt = new Option(`${flag} <value...>`, desc);
            break;
        case "json":
            opt = new Option(`${flag} <json>`, `${desc} (JSON-encoded)`).argParser(raw => {
                try {
                    return JSON.parse(raw);
                } catch (err) {
                    throw new Error(`${flag} must be valid JSON: ${err instanceof Error ? err.message : String(err)}`);
                }
            });
            break;
        case "string":
        default:
            opt = new Option(`${flag} <value>`, desc);
            break;
    }

    if (meta.defaultValue !== undefined) {
        opt.default(meta.defaultValue);
    }
    if (!meta.optional) {
        opt.makeOptionMandatory(true);
    }

    cmd.addOption(opt);
}

export function registerPositional(cmd: Command, fieldName: string, meta: ZodFieldMeta): void {
    const placeholder = meta.optional ? `[${fieldName}]` : `<${fieldName}>`;
    const desc = meta.description || "(no description)";

    cmd.argument(placeholder, desc, (raw: string) => parseFromString(raw, meta));
}
