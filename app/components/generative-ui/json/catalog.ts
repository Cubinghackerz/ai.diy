import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod/v4";
import { RICH_ICON_NAMES } from "../rich-icons";

const tone = z.enum(["neutral", "info", "success", "warning", "danger"]);

/**
 * Domain-neutral json-render catalog. The model may only use these components
 * and the `ask` action. There is no HTML, script, URL, or image-source prop:
 * pictures come from files that run_python saved in this chat.
 */
export const jsonCatalog = defineCatalog(schema, {
    components: {
        Stack: {
            props: z.object({
                direction: z.enum(["vertical", "horizontal"]).optional(),
                gap: z.enum(["sm", "md", "lg"]).optional(),
            }),
            slots: ["default"],
            description:
                "Lays children out in a column (default) or row. Use it as the root and to group content.",
        },
        Card: {
            props: z.object({
                title: z.string().optional(),
                subtitle: z.string().optional(),
                icon: z.enum(RICH_ICON_NAMES).optional(),
            }),
            slots: ["default"],
            description: "A bordered panel with an optional title, subtitle and icon.",
        },
        Tabs: {
            props: z.object({ labels: z.array(z.string().max(60)).min(1).max(8) }),
            slots: ["default"],
            description:
                "Switchable panels. labels has one tab name per child, in order; child N is shown under label N. Use for views of the same data (for example by month or by region).",
        },
        Disclosure: {
            props: z.object({ title: z.string(), open: z.boolean().optional() }),
            slots: ["default"],
            description: "A collapsible section for secondary detail. open: true expands it first.",
        },
        Heading: {
            props: z.object({ text: z.string(), level: z.enum(["1", "2", "3"]).optional() }),
            slots: [],
            description: "A heading. level 1 is largest; default 2.",
        },
        Text: {
            props: z.object({ text: z.string(), muted: z.boolean().optional() }),
            slots: [],
            description: "A paragraph of plain text (no markdown, no HTML).",
        },
        Badge: {
            props: z.object({ text: z.string(), tone: tone.optional() }),
            slots: [],
            description: "A small status label.",
        },
        Callout: {
            props: z.object({
                title: z.string().optional(),
                text: z.string(),
                tone: tone.optional(),
            }),
            slots: [],
            description: "A highlighted note for tips, warnings or results.",
        },
        Metric: {
            props: z.object({
                label: z.string(),
                value: z.string(),
                change: z.string().optional().describe("e.g. '+4.2%'"),
                trend: z.enum(["up", "down", "flat"]).optional(),
                icon: z.enum(RICH_ICON_NAMES).optional(),
            }),
            slots: [],
            description:
                "A key figure with a label and optional change indicator. Place several in a horizontal Stack.",
        },
        Table: {
            props: z.object({
                columns: z.array(z.string()).max(8),
                rows: z.array(z.array(z.string())).max(50),
                caption: z.string().optional(),
            }),
            slots: [],
            description: "A data table. Every row must have one string per column.",
        },
        BarChart: {
            props: z.object({
                title: z.string().optional(),
                labels: z.array(z.string()).max(24),
                values: z.array(z.number()).max(24),
                unit: z.string().optional(),
            }),
            slots: [],
            description: "A simple bar chart; labels and values must be the same length.",
        },
        LineChart: {
            props: z.object({
                title: z.string().optional(),
                labels: z.array(z.string()).max(48),
                values: z.array(z.number()).max(48),
                unit: z.string().optional(),
            }),
            slots: [],
            description: "A simple line chart for a trend over ordered labels.",
        },
        Progress: {
            props: z.object({ label: z.string(), value: z.number().min(0).max(100) }),
            slots: [],
            description: "A labelled progress bar; value is a percentage from 0 to 100.",
        },
        List: {
            props: z.object({
                items: z.array(z.string()).max(30),
                ordered: z.boolean().optional(),
            }),
            slots: [],
            description: "A bulleted or numbered list of short plain-text items.",
        },
        Figure: {
            props: z.object({
                filename: z.string().describe("Image file already saved by run_python"),
                caption: z.string().optional(),
            }),
            slots: [],
            description:
                "Shows a chart or image that run_python saved with matplotlib savefig (PNG/SVG). Run Python first, then use the exact filename.",
        },
        Button: {
            props: z.object({ label: z.string() }),
            slots: [],
            description:
                "A button. Wire it with on.press = { action: 'ask', params: { message } } to send that message as the user's next turn.",
        },
    },
    actions: {
        ask: {
            params: z.object({ message: z.string().max(300) }),
            description: "Sends params.message to the assistant as the user's next message.",
        },
    },
});

export type JsonCatalog = typeof jsonCatalog;
