import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineGraph } from "~/components/assistant-ui/inline-graph";
import { SimpleToolRow } from "~/components/assistant-ui/simple-tool-row";
import { CanvasProvider } from "~/lib/canvas";

const base = {
    type: "tool-call" as const,
    toolCallId: "call_1",
    args: {},
    addResult: () => undefined,
    resume: () => undefined,
    respondToApproval: () => undefined,
    isError: false,
};

function row(props: Record<string, unknown>) {
    const Row = SimpleToolRow as unknown as (p: Record<string, unknown>) => React.ReactElement;
    return render(
        <CanvasProvider>
            <Row {...base} {...props} />
        </CanvasProvider>,
    );
}

const composioArgs = JSON.stringify({
    tools: [{ tool_slug: "DISCORD_LIST_MY_GUILDS", arguments: {} }],
});
const rawResult = '{"content":[{"type":"text","text":"{\\"successful\\":true}"}]}';

describe("Simple interface tool rows", () => {
    it("shows one plain line, never the raw JSON, until Details is opened", () => {
        const { container } = row({
            toolName: "mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL",
            argsText: composioArgs,
            result: rawResult,
            status: { type: "complete" },
        });
        expect(screen.getByText("Used Discord")).toBeTruthy();
        expect(container.textContent).not.toContain("tool_slug");
        expect(container.textContent).not.toContain("successful");
        fireEvent.click(screen.getByRole("button", { name: "Details" }));
        expect(container.textContent).toContain("tool_slug");
        expect(screen.getByRole("button", { name: "Hide details" })).toBeTruthy();
    });

    it("says what is happening while a tool runs, with no Details yet", () => {
        row({
            toolName: "mcp_composio_COMPOSIO_SEARCH_TOOLS",
            argsText: "{}",
            status: { type: "running" },
        });
        expect(screen.getByText("Finding the right app action…")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
    });

    it("says plainly when a tool did not work", () => {
        row({
            toolName: "mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL",
            argsText: composioArgs,
            result: "Tool mcp_composio_COMPOSIO_MULTI_EXECUTE_TOOL failed: HTTP 500",
            status: { type: "complete" },
        });
        expect(screen.getByText("Couldn't finish: Discord")).toBeTruthy();
    });

    it("keeps the full view for tools that need the user", () => {
        const { container } = row({
            toolName: "mcp_composio_facebook_create_post",
            argsText: "{}",
            status: { type: "requires-action", reason: "tool-calls" },
        });
        expect(screen.getByRole("button", { name: "Allow" })).toBeTruthy();
        expect(container.querySelector('[data-slot="simple-tool-row"]')).toBeNull();
    });
});

describe("inline graph", () => {
    const render1 = (props: Record<string, unknown>) => {
        const Graph = InlineGraph as unknown as (p: Record<string, unknown>) => React.ReactElement;
        return render(<Graph {...base} toolName="graph_function" argsText="{}" {...props} />);
    };

    it("draws the graph in the message as an image, with a download link", () => {
        const { container } = render1({
            status: { type: "complete" },
            result: JSON.stringify({
                __aidiy_graph: true,
                title: "My graph",
                input: { functions: [{ expression: "x^2" }] },
                summary: "facts for the model",
            }),
        });
        const img = container.querySelector("img");
        expect(img?.getAttribute("alt")).toBe("My graph");
        const src = decodeURIComponent(img?.getAttribute("src") ?? "");
        expect(src).toMatch(/^data:image\/svg\+xml;charset=utf-8,<svg/);
        expect(src).toContain("<path");
        expect(src).not.toContain("facts for the model");
        expect(container.querySelector("a[download]")?.getAttribute("download")).toBe("graph.svg");
    });

    it("says it is drawing while the tool runs, and why when it could not", () => {
        const first = render1({ status: { type: "running" } });
        expect(screen.getByText("Drawing a graph…")).toBeTruthy();
        first.unmount();
        render1({ status: { type: "complete" }, result: 'Error: Unknown function "wat"' });
        expect(screen.getByText(/Couldn.t draw that graph: Unknown function/)).toBeTruthy();
    });
});
