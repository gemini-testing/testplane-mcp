import { createHash } from "node:crypto";
import type { PageSnapshotResult } from "../../responses/browser-helpers.js";

type AttrValue = string | true;

interface ParsedSnapshotNode {
    raw: string;
    tag?: string;
    id?: string;
    classes: string[];
    attrs: Record<string, AttrValue>;
    text?: string;
    children: ParsedSnapshotNode[];
    selfHash: string;
    subtreeHash: string;
    nodeCount: number;
}

interface ParseLineResult {
    raw: string;
    tag?: string;
    id?: string;
    classes: string[];
    attrs: Record<string, AttrValue>;
    text?: string;
}

interface TreeLine {
    indent: number;
    text: string;
}

interface MatchedChild {
    oldNode: ParsedSnapshotNode;
    newNode: ParsedSnapshotNode;
    oldIndex: number;
    newIndex: number;
}

interface FieldChanges {
    tagChanged: boolean;
    idChanged: boolean;
    rawChanged: boolean;
    removedClasses: string[];
    addedClasses: string[];
    removedAttrs: Array<[string, AttrValue]>;
    addedAttrs: Array<[string, AttrValue]>;
    changedAttrs: Array<[string, AttrValue, AttrValue]>;
    textChanged: boolean;
}

const MATCH_THRESHOLD = 85;
const LONG_VALUE_MAX_LENGTH = 96;
const HEADER_CLASS_LIMIT = 3;
const MAX_RENDERED_SUBTREE_NODES = 24;
const HEADER_ATTRS = ["role", "name", "aria-label"] as const;

function splitSnapshotTreeLines(content: string): TreeLine[] {
    return content
        .split("\n")
        .map(line => {
            const indent = line.length - line.trimStart().length;
            const trimmed = line.trimStart();

            return trimmed.startsWith("- ") ? { indent, text: trimmed.slice(2) } : null;
        })
        .filter((line): line is TreeLine => Boolean(line));
}

function stripTrailingNodeColon(value: string): string {
    let quote: string | null = null;
    let bracketDepth = 0;

    for (let index = 0; index < value.length; index += 1) {
        const char = value[index];

        if (quote) {
            if (char === quote && value[index - 1] !== "\\") {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (char === "[") {
            bracketDepth += 1;
            continue;
        }

        if (char === "]" && bracketDepth > 0) {
            bracketDepth -= 1;
        }
    }

    return bracketDepth === 0 && value.endsWith(":") ? value.slice(0, -1) : value;
}

function findTextStart(value: string): number {
    let quote: string | null = null;
    let bracketDepth = 0;
    let lastTextStart = -1;

    for (let index = 0; index < value.length; index += 1) {
        const char = value[index];

        if (quote) {
            if (char === quote && value[index - 1] !== "\\") {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            if (bracketDepth === 0 && index > 0 && /\s/.test(value[index - 1])) {
                lastTextStart = index;
            }
            quote = char;
            continue;
        }

        if (char === "[") {
            bracketDepth += 1;
            continue;
        }

        if (char === "]" && bracketDepth > 0) {
            bracketDepth -= 1;
        }
    }

    if (lastTextStart === -1 || value[value.length - 1] !== '"') {
        return -1;
    }

    return lastTextStart;
}

function unquote(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

function extractText(value: string): { rest: string; text?: string } {
    const textStart = findTextStart(value);
    if (textStart === -1) {
        return { rest: value };
    }

    return {
        rest: value.slice(0, textStart).trimEnd(),
        text: unquote(value.slice(textStart)),
    };
}

function findAttrStart(value: string): number {
    let quote: string | null = null;
    let attrStart = -1;

    for (let index = value.length - 1; index >= 0; index -= 1) {
        const char = value[index];

        if (quote) {
            if (char === quote && value[index - 1] !== "\\") {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (char === "[") {
            attrStart = index;
            break;
        }
    }

    return attrStart;
}

function tokenizeAttrs(value: string): string[] {
    const tokens: string[] = [];
    let quote: string | null = null;
    let token = "";

    for (let index = 0; index < value.length; index += 1) {
        const char = value[index];

        if (quote) {
            token += char;
            if (char === quote && value[index - 1] !== "\\") {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            token += char;
            continue;
        }

        if (/\s/.test(char)) {
            if (token) {
                tokens.push(token);
                token = "";
            }
            continue;
        }

        token += char;
    }

    if (token) {
        tokens.push(token);
    }

    return tokens;
}

function parseAttrs(value: string): Record<string, AttrValue> {
    const attrs: Record<string, AttrValue> = {};

    for (const token of tokenizeAttrs(value)) {
        const equalsIndex = token.indexOf("=");
        if (equalsIndex === -1) {
            attrs[token] = true;
            continue;
        }

        const name = token.slice(0, equalsIndex);
        if (!name) {
            continue;
        }

        attrs[name] = unquote(token.slice(equalsIndex + 1));
    }

    return attrs;
}

function extractAttrs(value: string): { rest: string; attrs: Record<string, AttrValue> } {
    const attrStart = findAttrStart(value);
    if (attrStart === -1 || !value.endsWith("]")) {
        return { rest: value, attrs: {} };
    }

    return {
        rest: value.slice(0, attrStart).trimEnd(),
        attrs: parseAttrs(value.slice(attrStart + 1, -1)),
    };
}

function parseHeader(value: string): Pick<ParseLineResult, "tag" | "id" | "classes"> {
    const result: Pick<ParseLineResult, "tag" | "id" | "classes"> = { classes: [] };
    const tagMatch = /^[^.#\s[\]"]+/.exec(value);
    let index = 0;

    if (tagMatch) {
        result.tag = tagMatch[0];
        index = tagMatch[0].length;
    }

    while (index < value.length) {
        const marker = value[index];
        if (marker !== "." && marker !== "#") {
            break;
        }

        const start = index + 1;
        index = start;
        while (index < value.length && value[index] !== "." && value[index] !== "#") {
            index += 1;
        }

        const token = value.slice(start, index);
        if (!token) {
            continue;
        }

        if (marker === "#") {
            result.id = token;
        } else {
            result.classes.push(token);
        }
    }

    return result;
}

function parseSnapshotLine(rawLine: string): ParseLineResult {
    try {
        const raw = stripTrailingNodeColon(rawLine.trim());
        const withText = extractText(raw);
        const withAttrs = extractAttrs(withText.rest);
        const header = parseHeader(withAttrs.rest);

        return {
            raw,
            ...header,
            attrs: withAttrs.attrs,
            text: withText.text,
        };
    } catch {
        return {
            raw: rawLine.trim(),
            classes: [],
            attrs: {},
        };
    }
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }

    if (!value || typeof value !== "object") {
        return JSON.stringify(value);
    }

    return `{${Object.keys(value)
        .sort()
        .map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
        .join(",")}}`;
}

function hashString(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function getSelfHash(node: ParseLineResult): string {
    return hashString(
        stableStringify({
            raw: node.tag ? undefined : node.raw,
            tag: node.tag,
            id: node.id,
            classes: [...node.classes].sort(),
            attrs: node.attrs,
            text: node.text,
        }),
    );
}

function recursiveRecomputeState(node: ParsedSnapshotNode): void {
    for (const child of node.children) {
        recursiveRecomputeState(child);
    }

    node.nodeCount = 1 + node.children.reduce((sum, child) => sum + child.nodeCount, 0);
    node.subtreeHash = hashString(`${node.selfHash}|${node.children.map(child => child.subtreeHash).join("|")}`);
}

function parseSnapshot(content: string): ParsedSnapshotNode[] {
    const root: ParsedSnapshotNode = {
        raw: "",
        classes: [],
        attrs: {},
        children: [],
        selfHash: "",
        subtreeHash: "",
        nodeCount: 0,
    };
    const stack: Array<{ indent: number; node: ParsedSnapshotNode }> = [{ indent: -1, node: root }];

    for (const line of splitSnapshotTreeLines(content)) {
        const parsedLine = parseSnapshotLine(line.text);
        const node: ParsedSnapshotNode = {
            ...parsedLine,
            children: [],
            selfHash: getSelfHash(parsedLine),
            subtreeHash: "",
            nodeCount: 1,
        };

        while (stack[stack.length - 1].indent >= line.indent) {
            stack.pop();
        }

        stack[stack.length - 1].node.children.push(node);
        stack.push({ indent: line.indent, node });
    }

    recursiveRecomputeState(root);

    return root.children;
}

function attrValueToString(value: AttrValue | undefined): string {
    return value === true ? "true" : String(value ?? "");
}

function getImportantAttrScore(oldNode: ParsedSnapshotNode, newNode: ParsedSnapshotNode, attrName: string): number {
    const oldValue = oldNode.attrs[attrName];
    const newValue = newNode.attrs[attrName];

    return oldValue !== undefined && newValue !== undefined && oldValue === newValue ? 1 : 0;
}

function getClassSimilarity(oldNode: ParsedSnapshotNode, newNode: ParsedSnapshotNode): number {
    if (!oldNode.classes.length && !newNode.classes.length) {
        return 0;
    }

    const oldClasses = new Set(oldNode.classes);
    const newClasses = new Set(newNode.classes);
    const intersection = [...oldClasses].filter(className => newClasses.has(className)).length;
    const union = new Set([...oldClasses, ...newClasses]).size;

    return union === 0 ? 0 : intersection / union;
}

function scoreNodePair(
    oldNode: ParsedSnapshotNode,
    newNode: ParsedSnapshotNode,
    oldIndex: number,
    newIndex: number,
): number {
    if (oldNode.subtreeHash === newNode.subtreeHash) {
        return 10_000 - Math.abs(oldIndex - newIndex);
    }

    let score = 0;

    if (oldNode.selfHash === newNode.selfHash) {
        score += 500;
    }
    if (oldNode.raw === newNode.raw) {
        score += 200;
    }
    if (oldNode.tag && oldNode.tag === newNode.tag) {
        score += 45;
    } else if (oldNode.tag || newNode.tag) {
        score -= 40;
    }
    if (oldNode.id && newNode.id && oldNode.id === newNode.id) {
        score += 160;
    }
    score += getImportantAttrScore(oldNode, newNode, "role") * 90;
    score += getImportantAttrScore(oldNode, newNode, "name") * 90;
    score += getImportantAttrScore(oldNode, newNode, "aria-label") * 90;
    if (oldNode.text && newNode.text && oldNode.text === newNode.text) {
        score += 80;
    }
    if (
        oldIndex === newIndex &&
        oldNode.tag &&
        oldNode.tag === newNode.tag &&
        oldNode.children.length === newNode.children.length
    ) {
        score += 25;
    }
    score += getClassSimilarity(oldNode, newNode) * 80;
    score += Math.max(0, 24 - Math.abs(oldIndex - newIndex) * 4);

    return score;
}

function matchChildren(
    oldChildren: readonly ParsedSnapshotNode[],
    newChildren: readonly ParsedSnapshotNode[],
): MatchedChild[] {
    const pairs: Array<MatchedChild & { score: number }> = [];

    for (let oldIndex = 0; oldIndex < oldChildren.length; oldIndex += 1) {
        for (let newIndex = 0; newIndex < newChildren.length; newIndex += 1) {
            const score = scoreNodePair(oldChildren[oldIndex], newChildren[newIndex], oldIndex, newIndex);
            if (score >= MATCH_THRESHOLD) {
                pairs.push({
                    oldNode: oldChildren[oldIndex],
                    newNode: newChildren[newIndex],
                    oldIndex,
                    newIndex,
                    score,
                });
            }
        }
    }

    pairs.sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        if (left.newIndex !== right.newIndex) {
            return left.newIndex - right.newIndex;
        }

        return left.oldIndex - right.oldIndex;
    });

    const usedOldIndexes = new Set<number>();
    const usedNewIndexes = new Set<number>();
    const matches: MatchedChild[] = [];

    for (const pair of pairs) {
        if (usedOldIndexes.has(pair.oldIndex) || usedNewIndexes.has(pair.newIndex)) {
            continue;
        }

        usedOldIndexes.add(pair.oldIndex);
        usedNewIndexes.add(pair.newIndex);
        matches.push(pair);
    }

    return matches.sort((left, right) => left.newIndex - right.newIndex || left.oldIndex - right.oldIndex);
}

function truncateValue(value: string): string {
    return value.length > LONG_VALUE_MAX_LENGTH ? `${value.slice(0, LONG_VALUE_MAX_LENGTH - 3)}...` : value;
}

function quoteValue(value: string): string {
    return JSON.stringify(truncateValue(value));
}

function renderAttr(name: string, value: AttrValue): string {
    return value === true ? name : `${name}=${quoteValue(value)}`;
}

function renderNodeHeader(node: ParsedSnapshotNode): string {
    if (!node.tag) {
        return truncateValue(node.raw);
    }

    const classSuffix = node.classes
        .slice(0, HEADER_CLASS_LIMIT)
        .map(className => `.${truncateValue(className)}`)
        .join("");
    const omittedClassSuffix = node.classes.length > HEADER_CLASS_LIMIT ? ".(...)" : "";
    const idSuffix = node.id ? `#${truncateValue(node.id)}` : "";
    const attrs = HEADER_ATTRS.filter(attrName => node.attrs[attrName] !== undefined)
        .map(attrName => renderAttr(attrName, node.attrs[attrName]))
        .join(" ");
    const attrsSuffix = attrs ? `[${attrs}]` : "";
    const textSuffix = node.text === undefined ? "" : ` ${quoteValue(node.text)}`;

    return `${node.tag}${classSuffix}${omittedClassSuffix}${idSuffix}${attrsSuffix}${textSuffix}`;
}

function diffFields(oldNode: ParsedSnapshotNode, newNode: ParsedSnapshotNode): FieldChanges {
    const oldClasses = new Set(oldNode.classes);
    const newClasses = new Set(newNode.classes);
    const oldAttrNames = Object.keys(oldNode.attrs).sort();
    const newAttrNames = Object.keys(newNode.attrs).sort();
    const oldAttrNameSet = new Set(oldAttrNames);
    const newAttrNameSet = new Set(newAttrNames);
    const sharedAttrNames = oldAttrNames.filter(attrName => newAttrNameSet.has(attrName));

    return {
        tagChanged: oldNode.tag !== newNode.tag,
        idChanged: oldNode.id !== newNode.id,
        rawChanged: !oldNode.tag && !newNode.tag && oldNode.raw !== newNode.raw,
        removedClasses: [...oldClasses].filter(className => !newClasses.has(className)).sort(),
        addedClasses: [...newClasses].filter(className => !oldClasses.has(className)).sort(),
        removedAttrs: oldAttrNames
            .filter(attrName => !newAttrNameSet.has(attrName))
            .map(attrName => [attrName, oldNode.attrs[attrName]]),
        addedAttrs: newAttrNames
            .filter(attrName => !oldAttrNameSet.has(attrName))
            .map(attrName => [attrName, newNode.attrs[attrName]]),
        changedAttrs: sharedAttrNames
            .filter(attrName => oldNode.attrs[attrName] !== newNode.attrs[attrName])
            .map(attrName => [attrName, oldNode.attrs[attrName], newNode.attrs[attrName]]),
        textChanged: oldNode.text !== newNode.text,
    };
}

function hasFieldChanges(changes: FieldChanges): boolean {
    return (
        changes.tagChanged ||
        changes.idChanged ||
        changes.rawChanged ||
        changes.removedClasses.length > 0 ||
        changes.addedClasses.length > 0 ||
        changes.removedAttrs.length > 0 ||
        changes.addedAttrs.length > 0 ||
        changes.changedAttrs.length > 0 ||
        changes.textChanged
    );
}

function renderFieldChanges(changes: FieldChanges, oldNode: ParsedSnapshotNode, newNode: ParsedSnapshotNode): string[] {
    const lines: string[] = [];

    if (changes.tagChanged) {
        lines.push(`  tag: ${oldNode.tag ?? "(none)"} -> ${newNode.tag ?? "(none)"}`);
    }
    if (changes.idChanged) {
        lines.push(`  id: ${quoteValue(oldNode.id ?? "")} -> ${quoteValue(newNode.id ?? "")}`);
    }
    if (changes.rawChanged) {
        lines.push(`  raw: ${quoteValue(oldNode.raw)} -> ${quoteValue(newNode.raw)}`);
    }
    if (changes.textChanged) {
        lines.push(`  text: ${quoteValue(oldNode.text ?? "")} -> ${quoteValue(newNode.text ?? "")}`);
    }

    if (changes.removedClasses.length > 0 || changes.addedClasses.length > 0) {
        lines.push("  classes:");
        for (const className of changes.removedClasses) {
            lines.push(`    - ${truncateValue(className)}`);
        }
        for (const className of changes.addedClasses) {
            lines.push(`    + ${truncateValue(className)}`);
        }
    }

    if (changes.removedAttrs.length > 0 || changes.addedAttrs.length > 0 || changes.changedAttrs.length > 0) {
        lines.push("  attrs:");
        for (const [name, value] of changes.removedAttrs) {
            lines.push(`    - ${renderAttr(name, value)}`);
        }
        for (const [name, value] of changes.addedAttrs) {
            lines.push(`    + ${renderAttr(name, value)}`);
        }
        for (const [name, oldValue, newValue] of changes.changedAttrs) {
            lines.push(
                `    ~ ${name}: ${quoteValue(attrValueToString(oldValue))} -> ${quoteValue(attrValueToString(newValue))}`,
            );
        }
    }

    return lines;
}

function countOmittedNodes(node: ParsedSnapshotNode, changedChildren: readonly DiffEntry[]): number {
    const changedNewIndexes = new Set(
        changedChildren
            .filter(entry => entry.kind !== "removed")
            .map(entry => entry.newIndex)
            .filter(index => index !== undefined),
    );
    let omitted = 0;

    for (let index = 0; index < node.children.length; index += 1) {
        if (changedNewIndexes.has(index)) {
            continue;
        }

        omitted += node.children[index].nodeCount;
    }

    return omitted;
}

type DiffEntry =
    | {
          kind: "changed";
          node: ParsedSnapshotNode;
          oldNode: ParsedSnapshotNode;
          children: DiffEntry[];
          oldIndex: number;
          newIndex: number;
      }
    | { kind: "added"; node: ParsedSnapshotNode; newIndex: number }
    | { kind: "removed"; node: ParsedSnapshotNode; oldIndex: number };

function diffNode(
    oldNode: ParsedSnapshotNode,
    newNode: ParsedSnapshotNode,
    oldIndex: number,
    newIndex: number,
): DiffEntry | null {
    if (oldNode.subtreeHash === newNode.subtreeHash) {
        return null;
    }

    const matches = matchChildren(oldNode.children, newNode.children);
    const matchedOldIndexes = new Set(matches.map(match => match.oldIndex));
    const matchedNewIndexes = new Set(matches.map(match => match.newIndex));
    const childEntries: DiffEntry[] = [];

    for (const match of matches) {
        const childEntry = diffNode(match.oldNode, match.newNode, match.oldIndex, match.newIndex);
        if (childEntry) {
            childEntries.push(childEntry);
        }
    }

    for (let index = 0; index < oldNode.children.length; index += 1) {
        if (!matchedOldIndexes.has(index)) {
            childEntries.push({ kind: "removed", node: oldNode.children[index], oldIndex: index });
        }
    }

    for (let index = 0; index < newNode.children.length; index += 1) {
        if (!matchedNewIndexes.has(index)) {
            childEntries.push({ kind: "added", node: newNode.children[index], newIndex: index });
        }
    }

    childEntries.sort((left, right) => {
        const leftIndex = left.kind === "removed" ? left.oldIndex : left.newIndex;
        const rightIndex = right.kind === "removed" ? right.oldIndex : right.newIndex;

        return leftIndex - rightIndex;
    });

    return {
        kind: "changed",
        node: newNode,
        oldNode,
        children: childEntries,
        oldIndex,
        newIndex,
    };
}

function diffTrees(oldNodes: readonly ParsedSnapshotNode[], newNodes: readonly ParsedSnapshotNode[]): DiffEntry[] {
    const matches = matchChildren(oldNodes, newNodes);
    const matchedOldIndexes = new Set(matches.map(match => match.oldIndex));
    const matchedNewIndexes = new Set(matches.map(match => match.newIndex));
    const entries: DiffEntry[] = [];

    for (const match of matches) {
        const entry = diffNode(match.oldNode, match.newNode, match.oldIndex, match.newIndex);
        if (entry) {
            entries.push(entry);
        }
    }

    for (let index = 0; index < oldNodes.length; index += 1) {
        if (!matchedOldIndexes.has(index)) {
            entries.push({ kind: "removed", node: oldNodes[index], oldIndex: index });
        }
    }

    for (let index = 0; index < newNodes.length; index += 1) {
        if (!matchedNewIndexes.has(index)) {
            entries.push({ kind: "added", node: newNodes[index], newIndex: index });
        }
    }

    return entries.sort((left, right) => {
        const leftIndex = left.kind === "removed" ? left.oldIndex : left.newIndex;
        const rightIndex = right.kind === "removed" ? right.oldIndex : right.newIndex;

        return leftIndex - rightIndex;
    });
}

function indentLines(lines: readonly string[], depth: number): string[] {
    const indent = "  ".repeat(depth);

    return lines.map(line => (line ? `${indent}${line}` : line));
}

function renderSubtree(
    node: ParsedSnapshotNode,
    prefix: "+" | "-",
    depth: number,
    budget: { remaining: number } = { remaining: MAX_RENDERED_SUBTREE_NODES },
): string[] {
    if (budget.remaining <= 0) {
        return [`${"  ".repeat(depth)}${prefix} ... subtree omitted: ${node.nodeCount} nodes`];
    }

    budget.remaining -= 1;

    const lines = [`${"  ".repeat(depth)}${prefix} ${renderNodeHeader(node)}`];

    for (const child of node.children) {
        if (budget.remaining <= 0) {
            const omittedNodes = node.children
                .slice(node.children.indexOf(child))
                .reduce((sum, omittedChild) => sum + omittedChild.nodeCount, 0);

            lines.push(`${"  ".repeat(depth + 1)}${prefix} ... subtree omitted: ${omittedNodes} nodes`);
            break;
        }

        lines.push(...renderSubtree(child, prefix, depth + 1, budget));
    }

    return lines;
}

function renderChangedEntry(entry: Extract<DiffEntry, { kind: "changed" }>, depth: number): string[] {
    const lines = [`${"  ".repeat(depth)}~ ${renderNodeHeader(entry.node)}`];
    const changes = diffFields(entry.oldNode, entry.node);
    const fieldLines = renderFieldChanges(changes, entry.oldNode, entry.node);
    const omittedNodes = countOmittedNodes(entry.node, entry.children);

    if (fieldLines.length > 0) {
        lines.push(...indentLines(fieldLines, depth));
    }

    if (entry.children.length === 0) {
        const omittedChildren = entry.node.children.reduce((sum, child) => sum + child.nodeCount, 0);
        if (omittedChildren > 0) {
            lines.push(`${"  ".repeat(depth + 1)}children unchanged: ${omittedChildren} nodes omitted`);
        }

        return lines;
    }

    if (hasFieldChanges(changes) || omittedNodes > 0) {
        lines.push(`${"  ".repeat(depth + 1)}...`);
    }

    lines.push(...entry.children.flatMap(child => renderEntry(child, depth + 1)));

    return lines;
}

function renderEntry(entry: DiffEntry, depth: number): string[] {
    if (entry.kind === "added") {
        return renderSubtree(entry.node, "+", depth);
    }

    if (entry.kind === "removed") {
        return renderSubtree(entry.node, "-", depth);
    }

    return renderChangedEntry(entry, depth);
}

export function diffPageSnapshots(baseline: PageSnapshotResult, target: PageSnapshotResult): PageSnapshotResult {
    const fallbackResult = {
        fenceLanguage: "yaml",
        content: "# Failed to diff snapshots, below is new snapshot as a fallback.\n" + target.content,
    } as const;
    if (baseline.fenceLanguage !== target.fenceLanguage || target.fenceLanguage !== "yaml") {
        return fallbackResult;
    }

    try {
        const baselineTree = parseSnapshot(baseline.content);
        const targetTree = parseSnapshot(target.content);
        const entries = diffTrees(baselineTree, targetTree);

        const lines =
            entries.length > 0
                ? entries.flatMap(entry => renderEntry(entry, 0))
                : ["# No DOM nodes changed between the selected times."];

        return {
            fenceLanguage: "diff",
            content: lines.join("\n"),
        };
    } catch {
        return fallbackResult;
    }
}
