import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { jsonCatalog } from "~/components/generative-ui/json/catalog";
import {
    JSONRENDER_EXAMPLE_PATCHES,
    JSONRENDER_INTERACTIVE_PATCHES,
    buildJsonRenderInstructions,
    catalogComponentLines,
} from "~/components/generative-ui/json/instructions";
import {
    JsonRenderContent,
    parseJsonRenderPatches,
    parseJsonRenderSpec,
} from "~/components/generative-ui/json/present";
import { richLibrary, richPromptOptions } from "~/components/generative-ui/library";
import { sanitizeModelInstructions } from "~/lib/server/frontend-tools";

vi.mock("~/lib/canvas", () => ({ useOptionalCanvas: () => ({ artifacts: [] }) }));

const spec = (elements: Record<string, unknown>, root = "main") =>
    JSON.stringify({ root, elements });

describe("json-render spec parsing", () => {
    it("accepts the example embedded in the model instructions", () => {
        expect(parseJsonRenderPatches(JSONRENDER_EXAMPLE_PATCHES, false).ok).toBe(true);
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

const add = (path: string, value: unknown, op = "add") => JSON.stringify({ op, path, value });
const node = (type: string, props: unknown, children: string[] = []) => ({
    type,
    props,
    children,
});

describe("json-render patch lines", () => {
    const stack = node("Stack", {}, ["a", "b"]);
    const text = (value: string) => node("Text", { text: value });

    it("renders the finished prefix while streaming and ignores a half-written line", () => {
        const lines = [
            add("/root", "main"),
            add("/elements/main", stack),
            add("/elements/a", text("first")),
            '{"op":"add","path":"/elements/b","value":{"type":"Text","props":{"te',
        ];
        const result = parseJsonRenderPatches(lines, true);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(Object.keys(result.spec.elements).sort()).toEqual(["a", "main"]);
        // The dangling child is left out until its line arrives.
        expect(result.spec.elements.main.children).toEqual(["a"]);
    });
    it("shows nothing until the root element has arrived", () => {
        expect(parseJsonRenderPatches([add("/root", "main")], true)).toEqual({
            ok: false,
            reason: "incomplete",
        });
        expect(parseJsonRenderPatches([], true)).toEqual({ ok: false, reason: "incomplete" });
    });
    it("is strict once the call has finished", () => {
        const lines = [add("/root", "main"), add("/elements/main", stack)];
        expect(parseJsonRenderPatches(lines, false)).toEqual({ ok: false, reason: "invalid" });
        const full = [...lines, add("/elements/a", text("1")), add("/elements/b", text("2"))];
        expect(parseJsonRenderPatches(full, false).ok).toBe(true);
    });
    it("applies replace and remove, and ignores every other path or operation", () => {
        const lines = [
            add("/root", "main"),
            add("/elements/main", node("Stack", {}, ["a", "b"])),
            add("/elements/a", text("old")),
            add("/elements/b", text("gone")),
            add("/elements/a", text("new"), "replace"),
            add("/elements/b", undefined, "remove"),
            add("/elements/main", node("Stack", {}, ["a"]), "replace"),
            add("/state/x", 1),
            add("/elements/main/props", {}),
            add("/elements/__proto__", text("x")),
            add("/elements/a", text("copy"), "copy"),
            "not json",
            "42",
        ];
        const result = parseJsonRenderPatches(lines, false);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(Object.keys(result.spec.elements).sort()).toEqual(["a", "main"]);
        expect(result.spec.elements.a.props).toEqual({ text: "new" });
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
    it("never stores or follows a __proto__ element key", () => {
        const stackOfProto = node("Stack", {}, ["__proto__"]);
        const lines = [
            add("/root", "main"),
            add("/elements/main", stackOfProto),
            add("/elements/__proto__", text("x")),
        ];
        // The key is refused, so the child is dangling: strict mode rejects it.
        expect(parseJsonRenderPatches(lines, false)).toEqual({ ok: false, reason: "invalid" });
        const progressive = parseJsonRenderPatches(lines, true);
        expect(progressive.ok).toBe(true);
        if (!progressive.ok) return;
        expect(Object.getPrototypeOf(progressive.spec.elements)).toBe(Object.prototype);
        expect(progressive.spec.elements.main.children).toEqual([]);
        // The legacy single-document path must hold the same line.
        const legacy = parseJsonRenderSpec(
            '{"root":"main","elements":{"main":{"type":"Stack","props":{},"children":[]},"__proto__":{"type":"Text","props":{"text":"x"},"children":[]}}}',
        );
        if (legacy.ok) {
            expect(Object.getPrototypeOf(legacy.spec.elements)).toBe(Object.prototype);
        }
    });
    it("keeps accepting legacy specs whose keys are not slug-shaped", () => {
        expect(
            parseJsonRenderSpec(
                '{"root":"revenue card","elements":{"revenue card":{"type":"Text","props":{"text":"x"},"children":[]}}}',
            ).ok,
        ).toBe(true);
    });
    it("still rejects unsafe props and unknown components inside patches", () => {
        const one = (value: unknown) =>
            parseJsonRenderPatches([add("/root", "main"), add("/elements/main", value)], false);
        expect(one(node("Iframe", { src: "https://evil.example" })).ok).toBe(false);
        expect(one(node("Text", { text: { $state: "/x" } })).ok).toBe(false);
        expect(one(node("Metric", { label: 3 })).ok).toBe(false);
    });
    it("limits how many lines and characters are read", () => {
        const lines = [add("/root", "main"), add("/elements/main", node("Stack", {}))];
        const filler = Array.from({ length: 600 }, () => add("/elements/x", text("x")));
        // Operations past the limit are dropped; the valid prefix is kept.
        expect(parseJsonRenderPatches([...lines, ...filler], true).ok).toBe(true);
        expect(parseJsonRenderPatches([add("/root", "main"), "x".repeat(70_000)], false)).toEqual({
            ok: false,
            reason: "invalid",
        });
    });
    it("drops state, visibility and non-ask actions here too", () => {
        const result = parseJsonRenderPatches(
            [
                add("/root", "main"),
                add("/elements/main", {
                    ...node("Button", { label: "Go" }),
                    visible: { $state: "/x" },
                    on: { press: { action: "setState", params: { statePath: "/x", value: 1 } } },
                }),
            ],
            false,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(Object.keys(result.spec.elements.main).sort()).toEqual([
            "children",
            "props",
            "type",
        ]);
    });
});

describe("json-render tabs and disclosure", () => {
    const patches = [
        add("/root", "main"),
        add("/elements/main", node("Tabs", { labels: ["Month", "Region"] }, ["m", "r"])),
        add("/elements/m", node("Text", { text: "by month panel" })),
        add("/elements/r", node("Text", { text: "by region panel" })),
    ];

    it("shows one panel at a time and switches on click and arrow keys", () => {
        render(
            <JsonRenderContent patches={patches} running={false} busy={false} onAsk={vi.fn()} />,
        );
        expect(screen.getByText("by month panel")).toBeTruthy();
        expect(screen.queryByText("by region panel")).toBeNull();
        fireEvent.click(screen.getByRole("tab", { name: "Region" }));
        expect(screen.getByText("by region panel")).toBeTruthy();
        expect(screen.queryByText("by month panel")).toBeNull();
        expect(screen.getByRole("tab", { name: "Region" }).getAttribute("aria-selected")).toBe(
            "true",
        );
        fireEvent.keyDown(screen.getByRole("tab", { name: "Region" }), { key: "ArrowLeft" });
        expect(screen.getByText("by month panel")).toBeTruthy();
    });
    it("expands and collapses a disclosure section", () => {
        render(
            <JsonRenderContent
                patches={[
                    add("/root", "main"),
                    add("/elements/main", node("Disclosure", { title: "Details" }, ["t"])),
                    add("/elements/t", node("Text", { text: "hidden detail" })),
                ]}
                running={false}
                busy={false}
                onAsk={vi.fn()}
            />,
        );
        expect(screen.queryByText("hidden detail")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Details" }));
        expect(screen.getByText("hidden detail")).toBeTruthy();
    });
    it("keeps the selected tab while later elements stream in", () => {
        const view = render(
            <JsonRenderContent
                patches={patches.slice(0, 3)}
                running={true}
                busy={false}
                onAsk={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole("tab", { name: "Region" }));
        view.rerender(
            <JsonRenderContent patches={patches} running={true} busy={false} onAsk={vi.fn()} />,
        );
        expect(screen.getByRole("tab", { name: "Region" }).getAttribute("aria-selected")).toBe(
            "true",
        );
        expect(screen.getByText("by region panel")).toBeTruthy();
    });
});

const bind = (name: string) => ({ $state: `/${name}` });

describe("json-render interactive state", () => {
    const withState = (state: unknown, elements: Record<string, unknown>) => [
        add("/state", state),
        add("/root", "main"),
        ...Object.entries(elements).map(([key, value]) => add(`/elements/${key}`, value)),
    ];

    it("accepts the interactive example embedded in the instructions", () => {
        const result = parseJsonRenderPatches(JSONRENDER_INTERACTIVE_PATCHES, false);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.spec.state).toEqual({ pitch: 0, roll: 0 });
        expect(result.spec.elements.reset.on).toEqual({ press: { action: "reset" } });
        // The bound rotation entries keep their expressions for the renderer.
        expect(result.spec.elements.plane.props.rotation).toEqual([bind("pitch"), 0, bind("roll")]);
    });
    it("keeps only primitive, flat, bounded state", () => {
        const result = parseJsonRenderPatches(
            [
                ...withState(
                    {
                        a: 1,
                        b: "x".repeat(500),
                        c: true,
                        d: { nested: 1 },
                        e: [1],
                        f: null,
                        g: Number.POSITIVE_INFINITY,
                        "bad key": 1,
                        ["__proto__"]: 1,
                    },
                    { main: node("Text", { text: "hi" }) },
                ),
                add("/state/h", 5),
                add("/state/deep/x", 5),
                add("/state/i", { no: 1 }),
            ],
            false,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(Object.keys(result.spec.state).sort()).toEqual(["a", "b", "c", "h"]);
        expect((result.spec.state.b as string).length).toBe(200);
        const many = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, i]));
        const capped = parseJsonRenderPatches(
            withState(many, { main: node("Text", { text: "hi" }) }),
            false,
        );
        expect(capped.ok && Object.keys(capped.spec.state)).toHaveLength(40);
    });
    it("allows $state only where a primitive is expected, and only the plain form", () => {
        const ok = (props: unknown, type = "Text") =>
            parseJsonRenderPatches(
                withState({ x: 1, name: "n" }, { main: node(type, props) }),
                false,
            ).ok;
        expect(ok({ text: bind("name") })).toBe(true);
        expect(ok({ label: "Users", value: bind("x") }, "Metric")).toBe(true);
        expect(ok({ label: "p", value: bind("x") }, "Progress")).toBe(true);
        // Not a primitive position (enum), not the plain form, or not a flat key.
        expect(ok({ text: "t", tone: bind("name") }, "Badge")).toBe(false);
        expect(ok({ text: { $cond: { $state: "/x" }, $then: "a", $else: "b" } })).toBe(false);
        expect(ok({ text: { $bindState: "/x" } })).toBe(false);
        expect(ok({ text: { $computed: "x" } })).toBe(false);
        expect(ok({ text: { $state: "/x/y" } })).toBe(false);
        expect(ok({ text: { $state: "/__proto__" } })).toBe(false);
        expect(ok({ text: { $state: "x" } })).toBe(false);
        expect(ok({ text: { $state: "/x", extra: 1 } })).toBe(false);
    });
    it("requires bound names to exist once the spec is complete, but not while streaming", () => {
        const lines = [
            add("/root", "main"),
            add("/elements/main", node("Text", { text: bind("later") })),
        ];
        expect(parseJsonRenderPatches(lines, false)).toEqual({ ok: false, reason: "invalid" });
        expect(parseJsonRenderPatches(lines, true).ok).toBe(true);
    });
    it("validates controls: existing state name, min below max, select value among options", () => {
        const slider = (props: Record<string, unknown>, state: unknown = { v: 5 }) =>
            parseJsonRenderPatches(
                withState(state, { main: node("Slider", { label: "L", ...props }) }),
                false,
            ).ok;
        expect(slider({ bind: "v", min: 0, max: 10 })).toBe(true);
        expect(slider({ bind: "missing", min: 0, max: 10 })).toBe(false);
        expect(slider({ bind: "v", min: 10, max: 0 })).toBe(false);
        expect(slider({ bind: "v", min: 0, max: 5000 })).toBe(false);
        expect(slider({ bind: "not a key", min: 0, max: 10 })).toBe(false);
        const select = (value: unknown) =>
            parseJsonRenderPatches(
                withState(
                    { mode: value },
                    { main: node("Select", { label: "M", bind: "mode", options: ["a", "b"] }) },
                ),
                false,
            ).ok;
        expect(select("a")).toBe(true);
        expect(select("zzz")).toBe(false);
    });
    it("accepts only ask and reset as button actions", () => {
        const on = (action: unknown) => {
            const result = parseJsonRenderPatches(
                [
                    add("/root", "main"),
                    add("/elements/main", {
                        ...node("Button", { label: "Go" }),
                        on: { press: action },
                    }),
                ],
                false,
            );
            return result.ok ? result.spec.elements.main.on : "invalid";
        };
        expect(on({ action: "reset" })).toEqual({ press: { action: "reset" } });
        expect(on({ action: "setState", params: { statePath: "/x", value: 1 } })).toBeUndefined();
        expect(on({ action: "navigate" })).toBeUndefined();
    });
    it("reads the legacy single-document state too", () => {
        const result = parseJsonRenderSpec(
            JSON.stringify({
                root: "main",
                state: { n: 3 },
                elements: { main: { type: "Text", props: { text: bind("n") }, children: [] } },
            }),
        );
        expect(result.ok && result.spec.state).toEqual({ n: 3 });
    });
});

describe("json-render interactive rendering", () => {
    const content = (lines: string[], extra: Record<string, unknown> = {}) => (
        <JsonRenderContent
            patches={lines}
            running={false}
            busy={false}
            onAsk={vi.fn()}
            {...extra}
        />
    );

    it("moves a slider and every prop bound to it follows", () => {
        render(
            content([
                add("/state", { n: 3 }),
                add("/root", "main"),
                add("/elements/main", node("Stack", {}, ["s", "t", "m"])),
                add(
                    "/elements/s",
                    node("Slider", { label: "Count", bind: "n", min: 0, max: 10, step: 1 }),
                ),
                add("/elements/t", node("Text", { text: bind("n") })),
                add("/elements/m", node("Metric", { label: "Doubled", value: bind("n") })),
            ]),
        );
        const slider = screen.getByRole("slider", { name: "Count" }) as HTMLInputElement;
        expect(slider.value).toBe("3");
        fireEvent.change(slider, { target: { value: "7" } });
        expect((screen.getByRole("slider", { name: "Count" }) as HTMLInputElement).value).toBe("7");
        expect(screen.getAllByText("7").length).toBeGreaterThanOrEqual(2);
    });
    it("toggles a switch and picks a segment", () => {
        render(
            content([
                add("/state", { on: false, mode: "a" }),
                add("/root", "main"),
                add("/elements/main", node("Stack", {}, ["t", "s", "v"])),
                add("/elements/t", node("Toggle", { label: "Enabled", bind: "on" })),
                add(
                    "/elements/s",
                    node("Select", { label: "Mode", bind: "mode", options: ["a", "b"] }),
                ),
                add("/elements/v", node("Text", { text: bind("mode") })),
            ]),
        );
        const toggle = screen.getByRole("switch", { name: "Enabled" });
        expect(toggle.getAttribute("aria-checked")).toBe("false");
        fireEvent.click(toggle);
        expect(screen.getByRole("switch", { name: "Enabled" }).getAttribute("aria-checked")).toBe(
            "true",
        );
        fireEvent.click(screen.getByRole("radio", { name: "b" }));
        expect(screen.getByRole("radio", { name: "b" }).getAttribute("aria-checked")).toBe("true");
        expect(screen.getAllByText("b").length).toBeGreaterThanOrEqual(2);
    });
    it("resets controls to their starting values", async () => {
        render(
            content([
                add("/state", { n: 2 }),
                add("/root", "main"),
                add("/elements/main", node("Stack", {}, ["s", "b"])),
                add(
                    "/elements/s",
                    node("Slider", { label: "N", bind: "n", min: 0, max: 10, step: 1 }),
                ),
                add("/elements/b", {
                    ...node("Button", { label: "Reset" }),
                    on: { press: { action: "reset" } },
                }),
            ]),
        );
        fireEvent.change(screen.getByRole("slider", { name: "N" }), { target: { value: "9" } });
        expect((screen.getByRole("slider", { name: "N" }) as HTMLInputElement).value).toBe("9");
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        await waitFor(() =>
            expect((screen.getByRole("slider", { name: "N" }) as HTMLInputElement).value).toBe("2"),
        );
    });
    it("keeps the user's slider value when more of the spec streams in", () => {
        const first = [
            add("/state", { n: 1 }),
            add("/root", "main"),
            add("/elements/main", node("Stack", {}, ["s"])),
            add("/elements/s", node("Slider", { label: "N", bind: "n", min: 0, max: 10, step: 1 })),
        ];
        const view = render(
            <JsonRenderContent patches={first} running={true} busy={false} onAsk={vi.fn()} />,
        );
        fireEvent.change(screen.getByRole("slider", { name: "N" }), { target: { value: "6" } });
        view.rerender(
            <JsonRenderContent
                patches={[...first, add("/state/extra", 4)]}
                running={true}
                busy={false}
                onAsk={vi.fn()}
            />,
        );
        expect((screen.getByRole("slider", { name: "N" }) as HTMLInputElement).value).toBe("6");
    });
    it("shows a text fallback for 3D when WebGL is not available", async () => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
        render(
            content([
                add("/state", { a: 10 }),
                add("/root", "main"),
                add(
                    "/elements/main",
                    node("Scene3D", {
                        rotation: [bind("a"), 0, 0],
                        parts: [{ shape: "box", size: [1, 1, 1] }],
                        caption: "A box",
                    }),
                ),
            ]),
        );
        expect(await screen.findByText(/needs WebGL/i, undefined, { timeout: 5000 })).toBeTruthy();
    });
    it("rejects scenes with too many or malformed parts", () => {
        const scene = (parts: unknown) =>
            parseJsonRenderPatches(
                [add("/root", "main"), add("/elements/main", node("Scene3D", { parts }))],
                false,
            ).ok;
        const box = { shape: "box", size: [1, 1, 1] };
        expect(scene([box])).toBe(true);
        expect(scene([])).toBe(false);
        expect(scene(Array.from({ length: 61 }, () => box))).toBe(false);
        expect(scene([{ shape: "mesh", size: [1, 1, 1] }])).toBe(false);
        expect(scene([{ shape: "box", size: [1, 1] }])).toBe(false);
        expect(scene([{ shape: "box", size: [1, 1, 1e9] }])).toBe(false);
        expect(scene([{ shape: "box", size: [1, 1, 1], color: "#ff0000" }])).toBe(false);
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
        expect(text.length).toBeLessThan(8_000);
    });
    it("together with the OpenUI prompt, fits the server's modelInstructions cap untruncated", () => {
        const combined = [
            richLibrary.prompt(richPromptOptions),
            buildJsonRenderInstructions(),
        ].join("\n\n");
        expect(sanitizeModelInstructions(combined)).toHaveLength(combined.trim().length);
    });
});
