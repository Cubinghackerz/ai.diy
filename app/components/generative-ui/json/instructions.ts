import { jsonCatalog } from "./catalog";
import { JSONRENDER_TOOL_NAME } from "./tool-name";

/**
 * The component lines come straight from the catalog so instructions cannot
 * drift from what the renderer accepts. json-render's own prompt (18k chars) is
 * written for streamed JSONL patches with state and repeat; this app uses a
 * single tool call with a static spec, so only its component list is reused.
 */
export function catalogComponentLines(): string[] {
    const prompt = jsonCatalog.prompt({ mode: "inline" });
    const start = prompt.indexOf("AVAILABLE COMPONENTS");
    const end = prompt.indexOf("AVAILABLE ACTIONS");
    if (start < 0 || end < 0) return [];
    return prompt
        .slice(start, end)
        .split("\n")
        .filter((line) => /^- [A-Z][A-Za-z0-9]+: /.test(line));
}

const el = (key: string, type: string, props: object, children: string[] = [], on?: object) => ({
    op: "add",
    path: `/elements/${key}`,
    value: { type, props, children, ...(on ? { on } : {}) },
});

/**
 * One JSON Patch operation per item, kept as data and validated by a test, so
 * the prompt example is always a legal spec.
 */
export const JSONRENDER_EXAMPLE_PATCHES: string[] = [
    { op: "add", path: "/root", value: "main" },
    el("main", "Stack", {}, ["m1", "t1", "b1"]),
    el("m1", "Metric", { label: "Revenue", value: "$48k", change: "+8%", trend: "up" }),
    el("t1", "Table", { columns: ["Item", "Qty"], rows: [["A", "3"]] }),
    el("b1", "Button", { label: "Break down by month" }, [], {
        press: { action: "ask", params: { message: "Break revenue down by month" } },
    }),
].map((patch) => JSON.stringify(patch));

const bound = (name: string) => ({ $state: `/${name}` });

/**
 * An interactive explainer: three sliders change state that rotates a 3D model.
 * Kept as data and validated by a test, like the dashboard example.
 */
export const JSONRENDER_INTERACTIVE_PATCHES: string[] = [
    { op: "add", path: "/state", value: { pitch: 0, roll: 0 } },
    { op: "add", path: "/root", value: "main" },
    el("main", "Stack", {}, ["plane", "p", "r", "reset"]),
    el("plane", "Scene3D", {
        rotation: [bound("pitch"), 0, bound("roll")],
        parts: [
            { shape: "cylinder", size: [0.5, 3, 0.5], rotation: [90, 0, 0], color: "white" },
            { shape: "box", size: [3.2, 0.08, 0.7], color: "blue" },
        ],
    }),
    el("p", "Slider", { label: "Pitch", bind: "pitch", min: -45, max: 45, unit: "°" }),
    el("r", "Slider", { label: "Roll", bind: "roll", min: -45, max: 45, unit: "°" }),
    el("reset", "Button", { label: "Reset" }, [], { press: { action: "reset" } }),
].map((patch) => JSON.stringify(patch));

export function buildJsonRenderInstructions(): string {
    return [
        `## Dashboards, charts and data views (${JSONRENDER_TOOL_NAME})`,
        `Call ${JSONRENDER_TOOL_NAME} with patches for dashboards, metric summaries, tables, bar or line charts, progress, comparisons and tabbed views. Use present_openui instead for plans, itineraries, photos, maps, forms and follow-up suggestions. Use one UI tool per answer; do not render the same content twice.`,
        `patches is an array of strings; each string is one JSON Patch operation. Send /root first, then each element with its parent before its children. Finished elements appear while you are still writing. Example: ${JSON.stringify(JSONRENDER_EXAMPLE_PATCHES)}`,
        `Rules: use only the component types listed below and give every element a unique key (letters, digits, - and _); every element has a children array (use [] for leaves) and every key in it must be added; props must match exactly; use plain text only (no markdown or HTML); never include URLs or image data; only add operations on /root and /elements/<key>. Tabs has one child per label. For a chart or image from data analysis, call run_python first and save it with matplotlib savefig, then show it with Figure using the exact filename.`,
        `Interactive explainers (sliders, toggles, choices, 3D): first add the values as {"op":"add","path":"/state","value":{"pitch":0}} (numbers, short strings or booleans, one level). A Slider, Toggle or Select with bind:"<name>" changes that value, and any number, string or boolean prop can use it as {"$state":"/<name>"}. Every bind and $state name must exist in the state. A Button with on.press {"action":"reset"} restores the start values. Use Scene3D for physical or spatial ideas, with only the few parts that explain it. Example: ${JSON.stringify(JSONRENDER_INTERACTIVE_PATCHES)}`,
        "Components:",
        ...catalogComponentLines(),
        'Action ask: on.press = {action:"ask",params:{message}} on a Button sends message as the user\'s next turn.',
    ].join("\n");
}
