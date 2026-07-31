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
    skillsEnabled?: boolean;
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

function skillDocument(input: {
    name: string;
    purpose: string;
    instructions: string;
    examples?: string;
}) {
    const name = input.name.trim().replace(/[^a-zA-Z0-9._ -]/g, "");
    const purpose = input.purpose.trim();
    const instructions = input.instructions.trim();
    const examples = input.examples?.trim();

    return `---
name: ${name || "custom-skill"}
description: ${purpose || "Reusable instructions for an AI task."}
---

# ${name || "Custom Skill"}

## Purpose
${purpose || "Define the outcome this skill should produce."}

## Instructions
${instructions || "Describe the task, constraints, inputs, outputs, and validation steps."}
${examples ? `\n## Examples\n${examples}` : ""}

## Safety
- Do not request, store, or expose API keys, cookies, tokens, or private files.
- Confirm destructive, external, or irreversible actions before performing them.
- Prefer deterministic, testable outputs and state assumptions explicitly.
`;
}

function frontendDesignBrief(input: {
    request: string;
    surface?: string;
    constraints?: string;
}) {
    return JSON.stringify(
        {
            skill: "frontend-design",
            request: input.request.trim(),
            surface: input.surface?.trim() || "web interface",
            constraints: input.constraints?.trim() || "Use the existing design system and preserve accessibility.",
            workflow: [
                "Clarify the primary user task and success state.",
                "Establish hierarchy, layout, responsive behavior, and empty/error/loading states before styling.",
                "Use a deliberate visual direction with semantic tokens, readable typography, and clear focus states.",
                "Prefer reusable components and minimal one-off abstractions.",
                "Validate keyboard access, contrast, reduced motion, mobile layout, and realistic content lengths.",
            ],
            output: [
                "Implementation-ready component structure",
                "Responsive layout and interaction notes",
                "Visual tokens and states",
                "Accessibility and validation checklist",
            ],
        },
        null,
        2,
    );
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

    if (settings.skillsEnabled !== false) {
        tools.create_skill = tool({
            description:
                "Create a reusable SKILL.md draft for a specialized AI workflow. Return the complete markdown document; do not write files or access private data.",
            inputSchema: z.object({
                name: z.string(),
                purpose: z.string(),
                instructions: z.string(),
                examples: z.string().optional(),
            }),
            execute: async (input) =>
                artifactPayload({
                    title: `${input.name.trim() || "Custom"} skill`,
                    filename: "SKILL.md",
                    content: skillDocument(input),
                    kind: "markdown",
                }),
        });

        tools.frontend_design_skill = tool({
            description:
                "Activate a frontend design skill for a UI request. Return an implementation-ready design brief covering hierarchy, responsive behavior, states, accessibility, and reusable components.",
            inputSchema: z.object({
                request: z.string(),
                surface: z.string().optional(),
                constraints: z.string().optional(),
            }),
            execute: async (input) => frontendDesignBrief(input),
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
