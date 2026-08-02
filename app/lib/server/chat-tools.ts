/**
 * Server-side chat tools — shared by /api/chat.
 * Uses free DuckDuckGo / optional SearXNG; LLM calls are BYOK (user's key).
 */

import { tool, type Tool } from "ai";
import { z } from "zod";
import { ARTIFACT_MARKER } from "~/lib/artifacts";
import { webSearch, type SearchEngine } from "~/lib/search";
import { connectorSearch } from "~/lib/search/connectors";
import type { ConnectorConfig } from "~/lib/types";
import { assertPublicHttpUrl } from "~/lib/server/ssrf";

export { ARTIFACT_MARKER };

export type ToolSettings = {
    webSearchEnabled?: boolean;
    calculatorEnabled?: boolean;
    pythonEnabled?: boolean;
    webSearchEngine?: SearchEngine;
    searxngUrl?: string;
    skillsEnabled?: boolean;
    connectors?: ConnectorConfig[];
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

function artifactPayload(input: {
    title: string;
    filename: string;
    content: string;
    kind: string;
    mimeType?: string;
}) {
    return JSON.stringify({
        [ARTIFACT_MARKER]: true,
        title: input.title,
        filename: input.filename,
        content: input.content,
        kind: input.kind,
        ...(input.mimeType ? { mimeType: input.mimeType } : {}),
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

function skillArchitectDocument(input: {
    name: string;
    description: string;
    job: string;
    workflow: string;
    purpose?: string;
    trigger?: string;
    nonTriggers?: string;
    inputs?: string;
    outcome?: string;
    environment?: string;
    riskLevel?: string;
    requirements?: string;
    decisionRules?: string;
    toolRules?: string;
    outputContract?: string;
    validation?: string;
    failureHandling?: string;
    references?: string;
    evaluations?: string;
}) {
    const name = input.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "custom-skill";
    const description = input.description.trim() || input.purpose?.trim() || "Reusable instructions for a defined AI task.";
    const section = (heading: string, value?: string) =>
        value?.trim() ? `\n## ${heading}\n${value.trim()}\n` : "";

    return `---
name: ${name}
description: ${description.replace(/\n/g, " ")}
version: 1.0.0
---

# Skill Architect

## Objective
Create the smallest reliable skill that enables an LLM or agent to complete this repeatable job consistently, safely, and efficiently.

### Skill Charter
**Job:** ${input.job.trim()}
**Trigger:** ${input.trigger?.trim() || description}
**Non-triggers:** ${input.nonTriggers?.trim() || "Unrelated requests and tasks outside the defined job."}
**Outcome:** ${input.outcome?.trim() || "A complete, inspectable, and validated result."}
**Risk level:** ${input.riskLevel?.trim() || "Moderate; handle missing information and external actions explicitly."}
${section("Inputs", input.inputs)}${section("Environment", input.environment)}${section("Requirements", input.requirements)}
## Workflow
${input.workflow.trim()}
${section("Decision Rules", input.decisionRules)}${section("Tool Rules", input.toolRules)}${section("Output Contract", input.outputContract)}${section("Validation", input.validation)}${section("Failure Handling", input.failureHandling)}${section("References", input.references)}
## Evaluation Suite
${input.evaluations?.trim() || `Include at least three positive activation cases, three negative activation cases, normal success, ambiguous input, missing input, tool failure, conflicting constraints, edge case, and unsafe/prohibited behavior. Define pass criteria for every case.`}

## Pre-delivery Validation
- Confirm the request is within scope.
- Confirm mandatory inputs were obtained or explicitly handled.
- Confirm the workflow and decision rules were followed.
- Confirm the output contract is satisfied.
- Confirm claims and tool results are supported.
- Confirm no prohibited or unrelated content was introduced.
- Keep the result no longer than necessary.

## Safety
- Do not request, store, or expose API keys, cookies, tokens, or private files.
- Require confirmation before destructive, public, financial, or irreversible actions.
- Never expose private chain-of-thought; provide concise conclusions, assumptions, evidence, and rationale instead.
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

function ultimateFrontendUISkill(input: {
    request: string;
    surface?: string;
    constraints?: string;
}) {
    return JSON.stringify(
        {
            name: "ultimate-frontend-ui",
            description:
                "Design and implement polished, responsive frontend experiences from natural-language briefs.",
            instructionPriority: [
                "Host-system and artifact instructions",
                "Explicit user requirements",
                "Functional correctness and data integrity",
                "Primary user task and business goal",
                "Accessibility and usability",
                "Responsive behavior",
                "Visual coherence and craft",
                "Performance and maintainability",
            ],
            workflow: [
                "Extract artifact type, audience, primary task, states, assets, constraints, and success criteria.",
                "Classify the interface as marketing, product, dashboard, utility, editorial, visualization, game, or 3D.",
                "Define a concise design thesis before coding.",
                "Set expression, density, and motion deliberately.",
                "Map default, loading, empty, error, success, disabled, and offline states before styling.",
                "Inspect the existing framework, design tokens, routing, data flow, accessibility conventions, and nearby components before changing an existing project.",
                "Implement semantic structure, responsive layout, primary interaction, visual system, secondary motion, then accessibility/performance hardening.",
                "Validate at mobile, tablet, and desktop widths, with keyboard navigation, reduced motion, realistic content, and console-error checks.",
            ],
            guardrails: [
                "Use existing project patterns when modifying an existing codebase.",
                "Do not invent metrics, testimonials, compliance claims, or private data.",
                "Use semantic controls, visible focus states, accessible names, keyboard access, and reduced-motion support.",
                "Prevent horizontal overflow and keep touch targets practical.",
                "Do not use eval, unsafe DOM insertion, or expose secrets.",
                "Deliver complete runnable behavior rather than decorative mockups.",
            ],
            request: input.request.trim(),
            surface: input.surface?.trim() || "web interface",
            constraints: input.constraints?.trim() || "Use the existing design system and preserve accessibility.",
        },
        null,
        2,
    );
}

function connectorGuide(connectors: ConnectorConfig[]): string {
    const enabled = connectors.filter((connector) => connector.enabled);
    if (enabled.length === 0) return "No connectors are enabled.";
    const guides: Record<string, string> = {
        tavily: "Tavily: web search and content-oriented search results; cite returned URLs.",
        brave: "Brave Search: web search results; respect rate limits and cite returned URLs.",
        exa: "Exa: semantic web search with highlights; cite returned URLs and distinguish excerpts from verified facts.",
        parallel: "Parallel: advanced web search; cite returned URLs and do not treat snippets as proof without fetching.",
        github: "GitHub: use only explicitly enabled read tools by default; commits, merges, deletion, and writes require separate confirmation.",
        supabase: "Supabase: inspect schemas and use publishable/anon access safely; never expose service-role keys and respect RLS.",
        postgres: "PostgreSQL: default to read-only SELECT, statement timeouts, and row limits; writes require explicit activation and confirmation.",
        s3: "S3-compatible storage: restrict bucket/prefix access, use signed URLs, and confirm writes/deletes.",
        "remote-mcp": "Remote MCP: inspect discovered tools and permissions first; separate read, write, and destructive actions.",
    };
    return enabled
        .map((connector) => `- ${connector.name}: ${guides[connector.kind] || "Use only discovered, explicitly enabled capabilities."}`)
        .join("\n");
}

export async function buildChatTools(settings: ToolSettings = {}) {
    const enableSearch = settings.webSearchEnabled !== false;
    const enableCalc = settings.calculatorEnabled !== false;
    // Python is a client-side tool. The browser executes it in Pyodide and
    // sends the result back before the model continues.
    const enablePython = settings.pythonEnabled !== false;

    const tools: Record<string, Tool> = {};

    if (settings.connectors?.some((connector) => connector.enabled)) {
        tools.connector_guide = tool({
            description:
                "Read the enabled connector/integration capability guide before using connected tools. Use it to understand available actions and permission boundaries.",
            inputSchema: z.object({
                connector: z.string().optional(),
            }),
            execute: async () => connectorGuide(settings.connectors ?? []),
        });
    }

    if (enableSearch) {
        const engine = settings.webSearchEngine ?? "duckduckgo";
        const engineLabel =
            engine === "searxng" && settings.searxngUrl?.trim()
                ? "SearXNG"
                : "DuckDuckGo";

        tools.web_search = tool({
            description: `Search the web using ${settings.connectors?.find((connector) => connector.enabled && ["tavily", "brave", "exa", "parallel"].includes(connector.kind))?.name || engineLabel} for real-time information, facts, news, and technical topics. Cite result URLs.`,
            inputSchema: z.object({
                query: z.string(),
                maxResults: z.number().optional(),
            }),
            execute: async ({ query, maxResults }) => {
                try {
                    const connector = settings.connectors?.find(
                        (candidate) =>
                            candidate.enabled &&
                            Boolean(candidate.apiKey?.trim()) &&
                            ["tavily", "brave", "exa", "parallel"].includes(candidate.kind),
                    );
                    const results = connector
                        ? await connectorSearch(connector, query, maxResults ?? 5)
                        : await webSearch(query, {
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
                "Execute Python 3 in the browser with Pyodide and return stdout or error logs. Useful imports include numpy, pandas, matplotlib, scipy, sympy, scikit-learn, pillow, networkx, BeautifulSoup, lxml, regex, python-dateutil, and pyyaml.",
            inputSchema: z.object({
                code: z.string(),
                description: z.string().optional(),
            }),
        });
    }

    if (settings.skillsEnabled !== false) {
        const skillArchitectInput = z.object({
            name: z.string(),
            description: z.string().optional(),
            job: z.string(),
            workflow: z.string(),
            purpose: z.string().optional(),
            trigger: z.string().optional(),
            nonTriggers: z.string().optional(),
            inputs: z.string().optional(),
            outcome: z.string().optional(),
            environment: z.string().optional(),
            riskLevel: z.string().optional(),
            requirements: z.string().optional(),
            decisionRules: z.string().optional(),
            toolRules: z.string().optional(),
            outputContract: z.string().optional(),
            validation: z.string().optional(),
            failureHandling: z.string().optional(),
            references: z.string().optional(),
            evaluations: z.string().optional(),
        });
        const createSkill = tool({
            description:
                "Use the skill-architect contract to create, audit, or improve a production-quality SKILL.md. Define one repeatable job, activation boundaries, inputs, workflow, decision rules, tool rules, output contract, validation, failure handling, and positive/negative evaluation cases. Return the complete markdown artifact; do not write files or access private data.",
            inputSchema: skillArchitectInput,
            execute: async (input) =>
                artifactPayload({
                    title: `${input.name.trim() || "Custom"} skill`,
                    filename: "SKILL.md",
                    content: skillArchitectDocument({
                        ...input,
                        description: input.description || input.purpose || "",
                    }),
                    kind: "markdown",
                }),
        });
        tools.create_skill = createSkill;
        tools.skill_architect = createSkill;

        tools.frontend_design_skill = tool({
            description:
                "Activate a frontend design skill for a UI request. Returns an implementation-ready design brief covering hierarchy, responsive behavior, states, accessibility, and reusable components.",
            inputSchema: z.object({
                request: z.string(),
                surface: z.string().optional(),
                constraints: z.string().optional(),
            }),
            execute: async (input) => {
                const brief = frontendDesignBrief(input);
                const title = `Design Brief: ${(input.request || "").trim().slice(0, 60)}`;
                return artifactPayload({
                    title: title.length > 5 ? title : "Design Brief",
                    filename: "design-brief.md",
                    content: brief,
                    kind: "markdown",
                });
            },
        });

        tools.ultimate_frontend_ui = tool({
            description:
                "Callable Ultimate Frontend UI skill. Use this before creating or substantially redesigning a frontend. It requires a design thesis, interface-mode classification, explicit states, responsive behavior, accessibility, performance, security, and validation. Return the implementation-ready skill contract and apply it to the user's request.",
            inputSchema: z.object({
                request: z.string(),
                surface: z.string().optional(),
                constraints: z.string().optional(),
            }),
            execute: async (input) => ultimateFrontendUISkill(input),
        });
    }

    tools.create_file = tool({
        description:
            "Create a document, code file, SVG, or interactive HTML preview in the Canvas panel. When the user asks for a downloadable file, always use this tool and cite the resulting file.",
        inputSchema: z.object({
            filename: z.string(),
            title: z.string(),
            content: z.string(),
            kind: z.string(),
            mimeType: z.string().optional(),
        }),
        execute: async ({ title, filename, content, kind, mimeType }) =>
            artifactPayload({ title, filename, content, kind, mimeType }),
    });

    tools.generate_file = tool({
        description:
            "Generate a downloadable file from content and cite it in the response. Use this for CSV, JSON, Markdown, TXT, SVG, HTML, or code files. For data-heavy files, use run_python first, then pass the generated content here.",
        inputSchema: z.object({
            filename: z.string(),
            title: z.string(),
            content: z.string(),
            kind: z.string(),
            mimeType: z.string().optional(),
        }),
        execute: async ({ title, filename, content, kind, mimeType }) =>
            artifactPayload({ title, filename, content, kind, mimeType }),
    });

    return tools;
}
