"use client";

/**
 * json-render tool: `present_jsonrender` takes a complete spec (as JSON text)
 * and renders it with a fixed catalog. The model can only pick catalog
 * components; there is no HTML, script, URL, or image-source prop, and the one
 * action (`ask`) just sends a chat message, and only when the thread is idle.
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

/**
 * Parses model output into a spec rebuilt from known-good pieces. catalog.validate
 * only checks structure and component names, so props are validated here
 * against each component's own schema, and fields the catalog does not expose
 * (state expressions, repeat, visibility, other actions) are dropped.
 * Never throws.
 */
export function parseJsonRenderSpec(text: unknown): ParsedSpec {
    if (typeof text !== "string" || text.trim() === "") return { ok: false, reason: "incomplete" };
    if (text.length > MAX_SPEC_CHARS) return INVALID;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, reason: "incomplete" };
    }
    try {
        const root = (parsed as { root?: unknown } | null)?.root;
        const raw = (parsed as { elements?: unknown } | null)?.elements;
        if (typeof root !== "string" || !raw || typeof raw !== "object" || Array.isArray(raw)) {
            return INVALID;
        }
        const entries = Object.entries(raw as Record<string, unknown>);
        if (entries.length === 0 || entries.length > MAX_ELEMENTS) return INVALID;

        const elements: SafeSpec["elements"] = {};
        for (const [key, element] of entries) {
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
            if (!def) return INVALID;
            const props = def.props.safeParse(record.props ?? {});
            if (!props.success) return INVALID;
            const children = record.children ?? [];
            if (!Array.isArray(children) || !children.every((child) => typeof child === "string")) {
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
        const spec: SafeSpec = { root, elements };
        // Dangling references and a missing root are caught by json-render itself.
        if (!validateSpec(spec as never).valid) return INVALID;
        if (!isAcyclic(spec)) return INVALID;
        return { ok: true, spec };
    } catch {
        return INVALID;
    }
}

export function JsonRenderContent({
    specText,
    running,
    onAsk,
    busy,
}: {
    specText: unknown;
    running: boolean;
    onAsk: (message: string) => void;
    busy: boolean;
}) {
    const parsed = useMemo(() => parseJsonRenderSpec(specText), [specText]);
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
    args: { spec?: unknown };
    status: { type: string };
}) {
    const aui = useAui();
    const running = useAuiState((state) => state.thread.isRunning);
    const generating = useChatGenerating();
    const busy = running || generating;
    return (
        <JsonRenderContent
            specText={args.spec}
            running={status.type === "running"}
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
                "Render a dashboard, metrics, table, chart, progress or comparison. spec is a JSON string for the json-render catalog described in the instructions.",
            parameters: z.object({
                spec: z
                    .string()
                    .describe(
                        'A complete JSON document: {"root":"<key>","elements":{"<key>":{"type":"<Component>","props":{...},"children":["<key>"]}}}',
                    ),
            }),
            execute: async () => ({ displayed: true }),
            render: JsonRenderPresent as never,
        },
    } as never) as Toolkit;
}
