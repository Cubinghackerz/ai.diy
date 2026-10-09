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
        .filter((line) => /^- [A-Z][A-Za-z]+: /.test(line));
}

/** Kept as data and validated by a test, so the prompt example is always a legal spec. */
export const JSONRENDER_EXAMPLE_SPEC = JSON.stringify({
    root: "main",
    elements: {
        main: { type: "Stack", props: {}, children: ["m1", "t1", "b1"] },
        m1: {
            type: "Metric",
            props: { label: "Revenue", value: "$48k", change: "+8%", trend: "up" },
        },
        t1: { type: "Table", props: { columns: ["Item", "Qty"], rows: [["A", "3"]] } },
        b1: {
            type: "Button",
            props: { label: "Break down by month" },
            on: { press: { action: "ask", params: { message: "Break revenue down by month" } } },
        },
    },
});

export function buildJsonRenderInstructions(): string {
    return [
        `## Dashboards, charts and data views (${JSONRENDER_TOOL_NAME})`,
        `Call ${JSONRENDER_TOOL_NAME} with spec set to a JSON string for dashboards, metric summaries, tables, bar or line charts, progress and comparisons. Use present_openui instead for plans, itineraries, photos, maps, forms and follow-up suggestions. Use one UI tool per answer; do not render the same content twice.`,
        `Spec format: ${JSONRENDER_EXAMPLE_SPEC}`,
        `Rules: use only the component types listed below and give every element a unique key; every element has a children array (use [] for leaves) and every key in it must exist; props must match exactly; use plain text only (no markdown or HTML); never include URLs or image data. Do not use state, repeat, visible or $-expressions. For a chart or image from data analysis, call run_python first and save it with matplotlib savefig, then show it with Figure using the exact filename.`,
        "Components:",
        ...catalogComponentLines(),
        'Action ask: on.press = {action:"ask",params:{message}} sends message as the user\'s next turn.',
    ].join("\n");
}
