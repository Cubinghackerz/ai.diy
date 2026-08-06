/**
 * Built-in Tools — Web search, calculator, fetch URL
 * 
 * These tools are available to all chat models. The tool schemas are sent
 * to the LLM, and when the LLM calls a tool, it is executed in the current
 * environment (browser in static deployments, Node server in self-hosted)
 * and the result fed back in a multi-turn loop.
 */

import type { LLMTool } from "~/lib/llm/types";
import { duckDuckGoSearch } from "~/lib/search";

export interface ToolExecutor {
    name: string;
    execute: (args: Record<string, unknown>) => Promise<string>;
}

// ─── Tool Schemas (sent to LLM) ──────────────────────────────────

export const WEB_SEARCH_TOOL: LLMTool = {
    type: "function",
    function: {
        name: "web_search",
        description: "Search the web for current information. Returns titles, URLs, and snippets for the top results. Use this when you need up-to-date information that may not be in your training data.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query",
                },
                maxResults: {
                    type: "number",
                    description: "Maximum number of results to return (default: 5)",
                },
            },
            required: ["query"],
        },
    },
};

export const CALCULATOR_TOOL: LLMTool = {
    type: "function",
    function: {
        name: "calculator",
        description: "Evaluate a mathematical expression. Supports basic arithmetic, parentheses, and common math functions (sqrt, sin, cos, tan, log, pow, abs, round, floor, ceil). Example: 'sqrt(144) + 2^3'",
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
        description: "Fetch the content of a web page URL and return the text content. Useful for reading articles or documentation.",
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

// ─── Tool Executors (run in browser for static deploys or on server) ──────────────────────────────

export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
    web_search: {
        name: "web_search",
        execute: async (args) => {
            const query = String(args.query ?? "");
            const maxResults = Number(args.maxResults ?? 5);
            if (!query) return "Error: No query provided";

            try {
                const results = await duckDuckGoSearch(query, maxResults);
                if (results.length === 0) return "No results found.";

                return results
                    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
                    .join("\n\n");
            } catch (err) {
                return `Search error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    },

    calculator: {
        name: "calculator",
        execute: async (args) => {
            const expr = String(args.expression ?? "");
            if (!expr) return "Error: No expression provided";

            try {
                const sanitized = expr.replace(/[^0-9+\-*/().,\s\w]/g, "");
                const mathScope: Record<string, unknown> = {
                    sqrt: Math.sqrt,
                    sin: Math.sin,
                    cos: Math.cos,
                    tan: Math.tan,
                    log: Math.log,
                    log2: Math.log2,
                    log10: Math.log10,
                    pow: Math.pow,
                    abs: Math.abs,
                    round: Math.round,
                    floor: Math.floor,
                    ceil: Math.ceil,
                    min: Math.min,
                    max: Math.max,
                    PI: Math.PI,
                    E: Math.E,
                    exp: Math.exp,
                };
                const fn = new Function(...Object.keys(mathScope), `"use strict"; return (${sanitized});`);
                const result = fn(...Object.values(mathScope));
                return `Result: ${result}`;
            } catch (err) {
                return `Error evaluating expression: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    },

    fetch_url: {
        name: "fetch_url",
        execute: async (args) => {
            const url = String(args.url ?? "");
            if (!url) return "Error: No URL provided";
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                return "Error: URL must start with http:// or https://";
            }

            try {
                const res = await fetch(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; ai.diy/0.1)",
                        "Accept": "text/html,application/json,text/plain",
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

    if (settings.webSearchEnabled) {
        tools.push(WEB_SEARCH_TOOL);
        tools.push(FETCH_URL_TOOL);
        executors.web_search = TOOL_EXECUTORS.web_search;
        executors.fetch_url = TOOL_EXECUTORS.fetch_url;
    }

    if (settings.calculatorEnabled) {
        tools.push(CALCULATOR_TOOL);
        executors.calculator = TOOL_EXECUTORS.calculator;
    }

    return { tools, executors };
}