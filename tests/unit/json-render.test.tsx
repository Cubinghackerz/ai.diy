import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { jsonCatalog } from "~/components/generative-ui/json/catalog";
import {
    JSONRENDER_EXAMPLE_SPEC,
    buildJsonRenderInstructions,
    catalogComponentLines,
} from "~/components/generative-ui/json/instructions";
import { JsonRenderContent, parseJsonRenderSpec } from "~/components/generative-ui/json/present";
import { richLibrary, richPromptOptions } from "~/components/generative-ui/library";
import { sanitizeModelInstructions } from "~/lib/server/frontend-tools";

vi.mock("~/lib/canvas", () => ({ useOptionalCanvas: () => ({ artifacts: [] }) }));

const spec = (elements: Record<string, unknown>, root = "main") =>
    JSON.stringify({ root, elements });

describe("json-render spec parsing", () => {
    it("accepts the example embedded in the model instructions", () => {
        expect(parseJsonRenderSpec(JSONRENDER_EXAMPLE_SPEC).ok).toBe(true);
    });
    it("treats unfinished JSON as incomplete, not as an error", () => {
        expect(parseJsonRenderSpec('{"root":"main","elem')).toEqual({
            ok: false,
            reason: "incomplete",
        });
        expect(parseJsonRenderSpec(undefined)).toEqual({ ok: false, reason: "incomplete" });
    });
    it("rejects components outside the catalog, bad props and oversized specs", () => {
        const bad = (type: string, props: unknown = {}) =>
            parseJsonRenderSpec(spec({ main: { type, props, children: [] } }));
        expect(bad("Iframe", { src: "https://evil.example" }).ok).toBe(false);
        expect(bad("Script", { code: "alert(1)" }).ok).toBe(false);
        expect(bad("Metric", { label: 3 }).ok).toBe(false);
        expect(parseJsonRenderSpec("x".repeat(70_000))).toEqual({ ok: false, reason: "invalid" });
    });
});

describe("json-render spec hardening", () => {
    const one = (type: string, props: unknown, extra: Record<string, unknown> = {}) =>
        parseJsonRenderSpec(spec({ main: { type, props, children: [], ...extra } }));

    it("validates each component's own props, not just its name", () => {
        expect(one("Text", { text: "hi" }).ok).toBe(true);
        expect(one("Metric", { label: 3 }).ok).toBe(false);
        expect(one("Table", { columns: "no", rows: 5 }).ok).toBe(false);
        expect(one("Figure", {}).ok).toBe(false);
        expect(one("Text", { text: { $state: "/secret" } }).ok).toBe(false);
    });
    it("rejects dangling children, cycles, and excessive depth or size", () => {
        const text = { type: "Text", props: { text: "x" } };
        expect(
            parseJsonRenderSpec(spec({ main: { type: "Stack", props: {}, children: ["ghost"] } }))
                .ok,
        ).toBe(false);
        expect(
            parseJsonRenderSpec(spec({ main: { type: "Stack", props: {}, children: ["main"] } }))
                .ok,
        ).toBe(false);
        expect(
            parseJsonRenderSpec(
                spec({
                    main: { type: "Stack", props: {}, children: ["b"] },
                    b: { type: "Stack", props: {}, children: ["main"] },
                }),
            ).ok,
        ).toBe(false);
        const chain: Record<string, unknown> = {};
        for (let i = 0; i < 20; i++) {
            chain[i === 0 ? "main" : `n${i}`] = {
                type: "Stack",
                props: {},
                children: i === 19 ? [] : [`n${i + 1}`],
            };
        }
        expect(parseJsonRenderSpec(spec(chain)).ok).toBe(false);
        const many: Record<string, unknown> = { main: { type: "Stack", props: {}, children: [] } };
        for (let i = 0; i < 250; i++) many[`t${i}`] = { ...text, children: [] };
        expect(parseJsonRenderSpec(spec(many)).ok).toBe(false);
    });
    it("drops state, repeat, visibility and every action except ask on buttons", () => {
        const result = parseJsonRenderSpec(
            spec({
                main: {
                    type: "Button",
                    props: { label: "Go" },
                    visible: { $state: "/x" },
                    repeat: { statePath: "/items" },
                    on: { press: { action: "setState", params: { statePath: "/x", value: 1 } } },
                },
            }),
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(Object.keys(result.spec.elements.main).sort()).toEqual([
            "children",
            "props",
            "type",
        ]);
        const other = parseJsonRenderSpec(
            spec({
                main: {
                    type: "Text",
                    props: { text: "x" },
                    on: { press: { action: "ask", params: { message: "hi" } } },
                },
            }),
        );
        expect(other.ok && "on" in other.spec.elements.main).toBe(false);
    });
});

describe("json-render content", () => {
    const content = JSON.stringify({
        root: "main",
        elements: {
            main: { type: "Stack", props: {}, children: ["h", "t", "n", "b"] },
            h: { type: "Heading", props: { text: "Q3 summary" } },
            t: { type: "Text", props: { text: '<img src=x onerror="window.__pwned=1">' } },
            n: {
                type: "Metric",
                props: { label: "Users", value: "1,204", trend: "up", change: "+3%" },
            },
            b: {
                type: "Button",
                props: { label: "Go deeper" },
                on: { press: { action: "ask", params: { message: "Go deeper on users" } } },
            },
        },
    });

    it("renders catalog components, shows model text as text, and sends ask messages", async () => {
        const onAsk = vi.fn();
        const { container } = render(
            <JsonRenderContent specText={content} running={false} busy={false} onAsk={onAsk} />,
        );
        expect(screen.getByRole("heading", { name: "Q3 summary" })).toBeTruthy();
        expect(screen.getByText("1,204")).toBeTruthy();
        expect(container.querySelector("img")).toBeNull();
        expect(container.textContent).toContain("onerror");
        fireEvent.click(screen.getByRole("button", { name: "Go deeper" }));
        await waitFor(() => expect(onAsk).toHaveBeenCalledWith("Go deeper on users"));
    });

    it("calls the latest onAsk even though json-render registers handlers only once", async () => {
        const stale = vi.fn();
        const fresh = vi.fn();
        const view = render(
            <JsonRenderContent specText={content} running={false} busy={true} onAsk={stale} />,
        );
        view.rerender(
            <JsonRenderContent specText={content} running={false} busy={false} onAsk={fresh} />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Go deeper" }));
        await waitFor(() => expect(fresh).toHaveBeenCalledWith("Go deeper on users"));
        expect(stale).not.toHaveBeenCalled();
    });

    it("disables ask buttons while the thread is busy", () => {
        render(
            <JsonRenderContent specText={content} running={false} busy={true} onAsk={vi.fn()} />,
        );
        expect(
            (screen.getByRole("button", { name: "Go deeper" }) as HTMLButtonElement).disabled,
        ).toBe(true);
    });

    it("shows progress while streaming and a plain error for an invalid finished spec", () => {
        const view = render(
            <JsonRenderContent specText={'{"root"'} running={true} busy={false} onAsk={vi.fn()} />,
        );
        expect(screen.getByRole("status").textContent).toContain("Building");
        view.unmount();
        render(
            <JsonRenderContent
                specText={spec({ main: { type: "Nope", props: {}, children: [] } })}
                running={false}
                busy={false}
                onAsk={vi.fn()}
            />,
        );
        expect(screen.getByRole("alert").textContent).toContain("could not be displayed");
        expect(document.body.textContent).not.toContain("Nope");
    });
});

describe("json-render instructions", () => {
    it("lists every catalog component and stays small", () => {
        const lines = catalogComponentLines();
        expect(lines).toHaveLength(Object.keys(jsonCatalog.data.components).length);
        const text = buildJsonRenderInstructions();
        expect(text).toContain("present_jsonrender");
        expect(text.length).toBeLessThan(7_000);
    });
    it("together with the OpenUI prompt, fits the server's modelInstructions cap untruncated", () => {
        const combined = [
            richLibrary.prompt(richPromptOptions),
            buildJsonRenderInstructions(),
        ].join("\n\n");
        expect(sanitizeModelInstructions(combined)).toHaveLength(combined.trim().length);
    });
});
