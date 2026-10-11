/**
 * Built-in Tools — calculator, fetch URL (live web search is Parallel / Firecrawl MCP or a connector)
 *
 * These tools are available to all chat models. The tool schemas are sent
 * to the LLM, and when the LLM calls a tool, the server executes it and
 * feeds the result back in a multi-turn loop.
 */

import type { LLMTool } from "~/lib/llm/types";
import { formatMathResult } from "~/lib/math-evaluator";
import { fetchPublicHttpUrl } from "~/lib/server/ssrf";

export interface ToolExecutor {
    name: string;
    execute: (args: Record<string, unknown>) => Promise<string>;
}

// ─── Tool Schemas (sent to LLM) ──────────────────────────────────

export const CALCULATOR_TOOL: LLMTool = {
    type: "function",
    function: {
        name: "calculator",
        description:
            "Evaluate a mathematical expression. Supports basic arithmetic, parentheses, and common math functions (sqrt, sin, cos, tan, log, pow, abs, round, floor, ceil). Example: 'sqrt(144) + 2^3'",
        parameters: {
            type: "object",
            properties: {
                expression: {
                    type: "string",
                    description: "The mathematical expression to evaluate",
                },
            },
            required: ["expression"],
        },
    },
};

export const FETCH_URL_TOOL: LLMTool = {
    type: "function",
    function: {
        name: "fetch_url",
        description:
            "Fetch the content of a web page URL and return the text content. Useful for reading articles or documentation.",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The URL to fetch",
                },
            },
            required: ["url"],
        },
    },
};

// ─── Tool Executors (run on server) ──────────────────────────────

export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
    calculator: {
        name: "calculator",
        execute: async (args) => formatMathResult(args.expression),
    },

    fetch_url: {
        name: "fetch_url",
        execute: async (args) => {
            const url = String(args.url ?? "");
            if (!url) return "Error: No URL provided";
            try {
                const res = await fetchPublicHttpUrl(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; ai.diy/0.1)",
                        Accept: "text/html,application/json,text/plain",
                    },
                    signal: AbortSignal.timeout(10000),
                });
                if (!res.ok) return `Fetch error: HTTP ${res.status}`;
                const contentType = res.headers.get("content-type") ?? "";
                const text = await res.text();

                if (contentType.includes("text/html")) {
                    const stripped = text
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                        .replace(/<[^>]*>/g, " ")
                        .replace(/\s+/g, " ")
                        .trim();
                    return stripped.slice(0, 4000);
                }
                return text.slice(0, 4000);
            } catch (err) {
                return `Fetch error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    },
};

// ─── Get enabled tools based on settings ─────────────────────────

export function getEnabledTools(settings: {
    webSearchEnabled: boolean;
    calculatorEnabled: boolean;
}): { tools: LLMTool[]; executors: Record<string, ToolExecutor> } {
    const tools: LLMTool[] = [];
    const executors: Record<string, ToolExecutor> = {};

    // No built-in web_search: live search is Parallel / Firecrawl or a BYOK connector.
    if (settings.webSearchEnabled) {
        tools.push(FETCH_URL_TOOL);
        executors.fetch_url = TOOL_EXECUTORS.fetch_url;
    }

    if (settings.calculatorEnabled) {
        tools.push(CALCULATOR_TOOL);
        executors.calculator = TOOL_EXECUTORS.calculator;
    }

    return { tools, executors };
}
