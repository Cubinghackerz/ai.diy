"use client";

import { useMemo } from "react";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { DownloadIcon, LoaderIcon } from "lucide-react";
import { buildGraph, GRAPH_MARKER, type GraphToolResult } from "~/lib/math-graph";

/** The tool whose result is a picture that belongs in the message itself. */
export const INLINE_GRAPH_TOOL = "graph_function";

function parseGraph(result: unknown): { svg: string; title: string } | null {
  if (typeof result !== "string" || !result.includes(GRAPH_MARKER)) return null;
  try {
    const parsed = JSON.parse(result) as Partial<GraphToolResult>;
    if (!parsed[GRAPH_MARKER] || !parsed.input) return null;
    // Drawn here from the spec: the tool result carries no picture.
    const { svg } = buildGraph(parsed.input, { summary: false });
    return { svg, title: String(parsed.title ?? "Graph") };
  } catch {
    return null;
  }
}

/**
 * A graph from the graph_function tool, drawn right in the message. A graph is
 * the answer, not a tool detail, so it is not tucked behind the tool-call
 * disclosure. Shown as an <img>, so the SVG can never run script.
 */
export const InlineGraph: ToolCallMessagePartComponent = ({ result, status }) => {
  const graph = useMemo(() => parseGraph(result), [result]);
  if (graph) {
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(graph.svg)}`;
    return (
      <figure
        data-slot="inline-graph"
        // The picture is always white, so the caption uses fixed light colours rather than theme tokens.
        className="my-3 max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700"
      >
        <img src={src} alt={graph.title} className="block h-auto w-full" loading="lazy" />
        <figcaption className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-600">
          <span>{graph.title}</span>
          <a
            href={src}
            download="graph.svg"
            className="inline-flex items-center gap-1 rounded text-neutral-600 outline-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            <DownloadIcon className="size-3" aria-hidden />
            SVG
          </a>
        </figcaption>
      </figure>
    );
  }
  if (status?.type === "running" || result === undefined) {
    return (
      <p className="my-2 flex items-center gap-2 text-xs text-muted-foreground" role="status">
        <LoaderIcon className="size-3 animate-spin [animation-duration:0.6s]" aria-hidden />
        Drawing a graph…
      </p>
    );
  }
  if (status?.type === "incomplete" && status.reason === "cancelled") return null;
  return (
    <p className="my-2 text-xs text-muted-foreground">
      Couldn&apos;t draw that graph
      {typeof result === "string" ? `: ${result.replace(/^Error:\s*/, "")}` : "."}
    </p>
  );
};
