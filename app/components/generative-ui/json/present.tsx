"use client";

/**
 * json-render tool: `present_jsonrender` takes JSON Patch lines (and, for saved
 * chats, a complete spec as JSON text) and renders them with a fixed catalog;
 * completed lines render while the call is still streaming. The model can
 * only pick catalog components; there is no HTML, script, URL, or image-source
 * prop, and the one action (`ask`) just sends a chat message, and only when
 * the thread is idle.
 */

import { defineToolkit, useAui, useAuiState, type Toolkit } from "@assistant-ui/react";
import { validateSpec } from "@json-render/core";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { Warning } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef } from "react";
import { z } from "zod/v4";
import { useChatGenerating } from "~/components/assistant-ui/ChatSessionContext";
import { ThreadBusyContext } from "../busy";
import { jsonCatalog } from "./catalog";
import { registry } from "./registry";

import { JSONRENDER_TOOL_NAME } from "./tool-name";
const MAX_SPEC_CHARS = 60_000;

export type SafeSpec = {
    root: string;
    elements: Record<
        string,
        {
            type: string;
            props: Record<string, unknown>;
            children: string[];
            on?: { press: { action: "ask"; params: { message: string } } };
        }
    >;
};

export type ParsedSpec =
    { ok: true; spec: SafeSpec } | { ok: false; reason: "incomplete" | "invalid" };

const MAX_ELEMENTS = 200;
const MAX_DEPTH = 12;
const INVALID = { ok: false, reason: "invalid" } as const;

/** Only `on.press = ask({ message })` is allowed; anything else is dropped. */
function askBinding(
    value: unknown,
): { press: { action: "ask"; params: { message: string } } } | undefined {
    const press = (value as { press?: { action?: unknown; params?: { message?: unknown } } } | null)
        ?.press;
    if (press?.action !== "ask" || typeof press.params?.message !== "string") return undefined;
    const message = press.params.message.trim().slice(0, 300);
    return message ? { press: { action: "ask", params: { message } } } : undefined;
}

/** True when every path from the root stays within the depth limit and never revisits a key. */
function isAcyclic(spec: SafeSpec): boolean {
    const visit = (key: string, path: string[]): boolean => {
        if (path.includes(key) || path.length >= MAX_DEPTH) return false;
        return spec.elements[key].children.every((child) => visit(child, [...path, key]));
    };
    return visit(spec.root, []);
}

type Built = ParsedSpec;

/**
 * Rebuilds a spec from known-good pieces. catalog.validate only checks
 * structure and component names, so props are validated here against each
 * component's own schema, and fields the catalog does not expose (state
 * expressions, repeat, visibility, other actions) are dropped.
 * With `progressive`, elements that are not valid yet (still streaming) are
 * skipped and child keys that do not exist yet are left out, so the finished
 * part of a dashboard can render while the rest arrives.
 * Never throws.
 */
function buildSpec(root: unknown, raw: unknown, progressive: boolean): Built {
    try {
        if (typeof root !== "string" || !raw || typeof raw !== "object" || Array.isArray(raw)) {
            return progressive ? { ok: false, reason: "incomplete" } : INVALID;
        }
        const entries = Object.entries(raw as Record<string, unknown>);
        if (entries.length === 0 || entries.length > MAX_ELEMENTS) {
            return progressive && entries.length === 0
                ? { ok: false, reason: "incomplete" }
                : INVALID;
        }

        const elements: SafeSpec["elements"] = {};
        for (const [key, element] of entries) {
            if (key === "__proto__") {
                if (progressive) continue;
                return INVALID;
            }
            const record = element as {
                type?: unknown;
                props?: unknown;
                children?: unknown;
                on?: unknown;
            };
            const def =
                typeof record?.type === "string" &&
                Object.hasOwn(jsonCatalog.data.components, record.type)
                    ? jsonCatalog.data.components[
                          record.type as keyof typeof jsonCatalog.data.components
                      ]
                    : null;
            const props = def?.props.safeParse(record.props ?? {});
            const children = record?.children ?? [];
            const wellFormed =
                def &&
                props?.success &&
                Array.isArray(children) &&
                children.every((child) => typeof child === "string");
            if (!wellFormed) {
                if (progressive) continue;
                return INVALID;
            }
            elements[key] = {
                type: record.type as string,
                props: props.data as Record<string, unknown>,
                children: children as string[],
                ...(record.type === "Button" && askBinding(record.on)
                    ? { on: askBinding(record.on) }
                    : {}),
            };
        }
        if (progressive) {
            for (const element of Object.values(elements)) {
                element.children = element.children.filter((child) =>
                    Object.hasOwn(elements, child),
                );
            }
            if (!Object.hasOwn(elements, root)) return { ok: false, reason: "incomplete" };
        }
        const spec: SafeSpec = { root, elements };
        // Dangling references and a missing root are caught by json-render itself.
        if (!validateSpec(spec as never).valid) return INVALID;
        if (!isAcyclic(spec)) return INVALID;
        return { ok: true, spec };
    } catch {
        return INVALID;
    }
}

/** Legacy path: one complete spec as JSON text (saved chats from before `patches`). */
export function parseJsonRenderSpec(text: unknown): ParsedSpec {
    if (typeof text !== "string" || text.trim() === "") return { ok: false, reason: "incomplete" };
    if (text.length > MAX_SPEC_CHARS) return INVALID;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, reason: "incomplete" };
    }
    const root = (parsed as { root?: unknown } | null)?.root;
    const elements = (parsed as { elements?: unknown } | null)?.elements;
    return buildSpec(root, elements, false);
}

const MAX_PATCHES = 500;
const ELEMENT_KEY = /^[A-Za-z0-9_-]{1,64}$/;

/** `__proto__` matches the key pattern but would hit the prototype setter on a plain object. */
const isElementKey = (key: string) => ELEMENT_KEY.test(key) && key !== "__proto__";

/**
 * Applies JSON Patch lines (each item is one operation as a JSON string) to an
 * empty spec. Only add / replace / remove on /root and /elements/<key> are
 * honoured; every other path or operation, and any line that is not complete
 * JSON yet, is ignored. Uses a Map so keys such as __proto__ stay inert.
 */
function applyPatchLines(lines: unknown[]): { root: unknown; elements: Record<string, unknown> } {
    let root: unknown;
    const elements = new Map<string, unknown>();
    let total = 0;
    for (const line of lines.slice(0, MAX_PATCHES)) {
        if (typeof line !== "string") continue;
        total += line.length;
        if (total > MAX_SPEC_CHARS) break;
        let patch: { op?: unknown; path?: unknown; value?: unknown } | null;
        try {
            patch = JSON.parse(line);
        } catch {
            continue;
        }
        if (!patch || typeof patch !== "object" || typeof patch.path !== "string") continue;
        const op = patch.op;
        if (op !== "add" && op !== "replace" && op !== "remove") continue;
        if (patch.path === "/root") {
            if (op !== "remove") root = patch.value;
            continue;
        }
        const match = /^\/elements\/([^/]+)$/.exec(patch.path);
        if (!match || !isElementKey(match[1])) continue;
        if (op === "remove") elements.delete(match[1]);
        else elements.set(match[1], patch.value);
    }
    return { root, elements: Object.fromEntries(elements) };
}

/**
 * `streaming` renders whatever has validly arrived so far (partial dashboard);
 * otherwise the full patch list must form a valid spec.
 */
export function parseJsonRenderPatches(patches: unknown, streaming: boolean): ParsedSpec {
    if (!Array.isArray(patches) || patches.length === 0) return { ok: false, reason: "incomplete" };
    const { root, elements } = applyPatchLines(patches);
    return buildSpec(root, elements, streaming);
}

export function JsonRenderContent({
    specText,
    patches,
    running,
    interrupted = false,
    onAsk,
    busy,
}: {
    /** Legacy complete spec as JSON text. */
    specText?: unknown;
    /** JSON Patch lines streamed by the model. */
    patches?: unknown;
    running: boolean;
    /** The call was cancelled mid-stream: show the finished part instead of an error. */
    interrupted?: boolean;
    onAsk: (message: string) => void;
    busy: boolean;
}) {
    const parsed = useMemo(
        () =>
            Array.isArray(patches)
                ? parseJsonRenderPatches(patches, running || interrupted)
                : parseJsonRenderSpec(specText),
        [patches, specText, running, interrupted],
    );
    // JSONUIProvider registers `handlers` once, so a closure over props would go
    // stale (for example keep `busy` from the streaming render). Always read the
    // latest callback through a ref and keep the handler object stable.
    const onAskRef = useRef(onAsk);
    useEffect(() => {
        onAskRef.current = onAsk;
    });
    const handlers = useMemo(
        () => ({
            ask: (params: Record<string, unknown>) => {
                if (typeof params?.message === "string" && params.message.trim()) {
                    onAskRef.current(params.message.trim().slice(0, 300));
                }
            },
        }),
        [],
    );
    if (!parsed.ok) {
        if (running || parsed.reason === "incomplete") {
            return (
                <div className="jr-loading" role="status" aria-busy>
                    {running ? "Building interface…" : "This interface could not be displayed."}
                </div>
            );
        }
        return (
            <div className="jr-error" role="alert">
                <Warning size={18} weight="duotone" aria-hidden />
                This interface could not be displayed.
            </div>
        );
    }
    return (
        <ThreadBusyContext.Provider value={busy}>
            <div className="jr-root" data-busy={busy}>
                <JSONUIProvider registry={registry} initialState={{}} handlers={handlers}>
                    <Renderer spec={parsed.spec as never} registry={registry} loading={running} />
                </JSONUIProvider>
            </div>
        </ThreadBusyContext.Provider>
    );
}

function JsonRenderPresent({
    args,
    status,
}: {
    args: { spec?: unknown; patches?: unknown };
    status: { type: string };
}) {
    const aui = useAui();
    const running = useAuiState((state) => state.thread.isRunning);
    const generating = useChatGenerating();
    const busy = running || generating;
    return (
        <JsonRenderContent
            specText={args.spec}
            patches={args.patches}
            running={status.type === "running"}
            interrupted={status.type === "incomplete"}
            busy={busy}
            onAsk={(text) => {
                if (busy) return;
                aui.thread.append({ role: "user", content: [{ type: "text", text }] });
            }}
        />
    );
}

export function createJsonRenderToolkit(): Toolkit {
    return defineToolkit({
        [JSONRENDER_TOOL_NAME]: {
            type: "frontend",
            display: "standalone",
            description:
                "Render a dashboard, metrics, table, chart, progress or comparison. patches is a list of JSON Patch lines for the json-render catalog described in the instructions; it renders as it streams.",
            parameters: z.object({
                patches: z
                    .array(z.string())
                    .describe(
                        'Each item is one JSON Patch operation as a JSON string. First {"op":"add","path":"/root","value":"<key>"}, then one {"op":"add","path":"/elements/<key>","value":{"type":"<Component>","props":{...},"children":["<key>"]}} per element, parents before children.',
                    ),
            }),
            execute: async () => ({ displayed: true }),
            render: JsonRenderPresent as never,
        },
    } as never) as Toolkit;
}
