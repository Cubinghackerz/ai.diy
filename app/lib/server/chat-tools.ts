/**
 * Server-side chat tools — shared by /api/chat.
 * Uses free DuckDuckGo / optional SearXNG; LLM calls are BYOK (user's key).
 */

import { tool } from "ai";
import { z } from "zod";
import { ARTIFACT_MARKER } from "~/lib/artifacts";
import { webSearch, type SearchEngine } from "~/lib/search";
import { isPythonRuntimeAvailable } from "~/lib/server/env";
import { assertPublicHttpUrl } from "~/lib/server/ssrf";

export { ARTIFACT_MARKER };

export type ToolSettings = {
    webSearchEnabled?: boolean;
    calculatorEnabled?: boolean;
    pythonEnabled?: boolean;
    webSearchEngine?: SearchEngine;
    searxngUrl?: string;
};

function evaluateMath(expression: string): string {
    const expr = String(expression ?? "").trim();
    if (!expr) return "Error: No expression provided";
    const sanitized = expr.replace(/[^0-9+\-*/().,\s\w^%]/g, "");
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
    try {
        const fn = new Function(
            ...Object.keys(mathScope),
            `"use strict"; return (${sanitized});`,
        );
        const result = fn(...Object.values(mathScope));
        return `Result: ${result}`;
    } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
}

async function runPythonScript(code: string): Promise<string> {
    const { execSync } = await import("node:child_process");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const tmpFile = path.join(
        os.tmpdir(),
        `prismium_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.py`,
    );
    fs.writeFileSync(tmpFile, String(code));
    try {
        const output = execSync(`python3 "${tmpFile}"`, {
            timeout: 10_000,
            encoding: "utf8",
            maxBuffer: 512 * 1024,
        });
        return output.trim() || "(Python script completed with no output)";
    } catch (err: unknown) {
        const e = err as { stderr?: string; stdout?: string; message?: string };
        return `Python error:\n${e.stderr || e.stdout || e.message || "Unknown error"}`;
    } finally {
        try {
            fs.unlinkSync(tmpFile);
        } catch {
            // ignore
        }
    }
}

function artifactPayload(input: {
    title: string;
    filename: string;
    content: string;
    kind: string;
}) {
    return JSON.stringify({
        [ARTIFACT_MARKER]: true,
        title: input.title,
        filename: input.filename,
        content: input.content,
        kind: input.kind,
    });
}

export async function buildChatTools(settings: ToolSettings = {}) {
    const enableSearch = settings.webSearchEnabled !== false;
    const enableCalc = settings.calculatorEnabled !== false;
    const enablePython =
        settings.pythonEnabled !== false && (await isPythonRuntimeAvailable());

    const tools: Record<string, ReturnType<typeof tool>> = {};

    if (enableSearch) {
        const engine = settings.webSearchEngine ?? "duckduckgo";
        const engineLabel =
            engine === "searxng" && settings.searxngUrl?.trim()
                ? "SearXNG"
                : "DuckDuckGo";

        tools.web_search = tool({
            description: `Search the web using ${engineLabel} for real-time information, facts, news, and technical topics.`,
            inputSchema: z.object({
                query: z.string(),
                maxResults: z.number().optional(),
            }),
            execute: async ({ query, maxResults }) => {
                try {
                    const results = await webSearch(query, {
                        maxResults: maxResults ?? 5,
                        engine,
                        searxngUrl: settings.searxngUrl,
                    });
                    if (!results.length) return "No results found.";
                    return results
                        .map(
                            (r, i) =>
                                `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`,
                        )
                        .join("\n\n");
                } catch (err) {
                    return `Search error: ${err instanceof Error ? err.message : String(err)}`;
                }
            },
        });

        tools.fetch_url = tool({
            description:
                "Fetch and extract text content from a public web page URL.",
            inputSchema: z.object({
                url: z.string().url(),
            }),
            execute: async ({ url }) => {
                try {
                    assertPublicHttpUrl(url);
                    const res = await fetch(url, {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (compatible; ai.diy/0.1)",
                            Accept: "text/html,application/json,text/plain",
                        },
                        signal: AbortSignal.timeout(10_000),
                    });
                    if (!res.ok) return `HTTP ${res.status}`;
                    const html = await res.text();
                    return html
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                        .replace(/<[^>]+>/g, " ")
                        .replace(/\s+/g, " ")
                        .trim()
                        .slice(0, 4000);
                } catch (err) {
                    return `Fetch error: ${err instanceof Error ? err.message : String(err)}`;
                }
            },
        });
    }

    if (enableCalc) {
        tools.calculator = tool({
            description:
                "Evaluate mathematical expressions accurately (sqrt, sin, cos, pow, etc.).",
            inputSchema: z.object({
                expression: z.string(),
            }),
            execute: async ({ expression }) => evaluateMath(expression),
        });
    }

    if (enablePython) {
        tools.run_python = tool({
            description:
                "Execute a Python 3 script and return stdout or error logs.",
            inputSchema: z.object({
                code: z.string(),
                description: z.string().optional(),
            }),
            execute: async ({ code }) => runPythonScript(code),
        });
    }

    tools.create_file = tool({
        description:
            "Create a document, code file, SVG, or interactive HTML preview in the Canvas panel.",
        inputSchema: z.object({
            filename: z.string(),
            title: z.string(),
            content: z.string(),
            kind: z.string(),
        }),
        execute: async ({ title, filename, content, kind }) =>
            artifactPayload({ title, filename, content, kind }),
    });

    return tools;
}
