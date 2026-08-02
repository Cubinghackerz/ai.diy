/**
 * Server-side chat tools — shared by /api/chat.
 * Uses free DuckDuckGo / optional SearXNG; LLM calls are BYOK (user's key).
 */

import { tool, type Tool } from "ai";
import { z } from "zod";
import { ARTIFACT_MARKER, type ArtifactContentEncoding } from "~/lib/artifacts";
import {
    duckDuckGoInstantAnswer,
    webSearch,
    type DuckDuckGoInstantAnswer,
    type SearchEngine,
} from "~/lib/search";
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
    memoryAvailable?: boolean;
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
    contentEncoding?: ArtifactContentEncoding;
}) {
    return JSON.stringify({
        [ARTIFACT_MARKER]: true,
        title: input.title,
        filename: input.filename,
        content: input.content,
        kind: input.kind,
        ...(input.mimeType ? { mimeType: input.mimeType } : {}),
        ...(input.contentEncoding ? { contentEncoding: input.contentEncoding } : {}),
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
    const skill = `---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that do not read as templated defaults.
license: Complete terms in LICENSE.txt
---

# Frontend Design

Approach this as the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's. Make deliberate, opinionated choices about palette, typography, and layout, and take one real aesthetic risk you can justify.

## Ground it in the subject

If the brief does not pin down the product or subject, name one concrete subject, its audience, and the page's single job before designing. Use the subject's materials, instruments, artifacts, and vernacular throughout. Build with real content and subject matter rather than generic filler.

## Design principles

- Treat the hero or opening state as a thesis, not a generic slogan.
- Pair display and body type deliberately; make typography part of the identity.
- Use structure, labels, numbering, and dividers only when they encode something true.
- Use motion for hierarchy, causality, state change, spatial relationship, progress, feedback, or story sequence; respect reduced motion.
- Match implementation complexity to the visual direction. Minimal directions require precision; maximal directions require complete execution.
- Spend boldness in one signature element and keep surrounding decisions disciplined.

## Process

1. Extract the artifact, audience, primary task, required states, assets, constraints, brand tone, accessibility risk, and success definition.
2. Classify the interface as marketing, product, dashboard, utility, editorial, visualization, game, or 3D.
3. Write a concise design thesis before coding.
4. Set expression, density, and motion deliberately.
5. Map default, hover/focus, loading, empty, error, success, disabled, and offline states where applicable.
6. Inspect the existing framework, tokens, routing, data flow, accessibility conventions, and nearby components before modifying an existing project.
7. Brainstorm a compact token system: 4–6 named colors, deliberate type roles, layout concept, wireframe, and one signature device.
8. Critique the plan against the brief. If it could have been produced for any similar prompt, revise it before coding.
9. Implement semantic structure, responsive layout, primary interaction, visual system, secondary motion, then accessibility/performance/security hardening.
10. Validate at mobile around 390px, tablet around 768px, and desktop around 1440px, including keyboard-only, reduced-motion, empty/error states, controls, and console errors.

## Required guardrails

- Reuse the existing design system and framework when modifying an existing project.
- Support widths down to 320px and prevent horizontal overflow.
- Use semantic controls, visible focus, accessible names, keyboard access, sufficient contrast, and reduced-motion support.
- Use real content and never invent metrics, testimonials, awards, compliance claims, or private data.
- Avoid generic cream/serif/terracotta, black/acid-green, broadsheet, mesh-gradient, glass, random bento, and meaningless dashboard defaults unless the brief justifies them.
- Do not use eval, unsafe DOM insertion, exposed secrets, or unimplemented visible controls.

## Output and validation contract

Return the completed implementation or implementation-ready brief, followed by material assumptions, validation results, and unresolved blockers. Before delivery verify scope, inputs, decision rules, output completeness, claims/tool results, accessibility, responsive behavior, performance, security, and realistic content lengths. Do not narrate routine hidden reasoning.`;
    return JSON.stringify(
        {
            skill: "frontend-design",
            instructions: skill,
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

function formatDuckDuckGoInstantAnswer(answer: DuckDuckGoInstantAnswer): string {
    const lines = [
        "DuckDuckGo Instant Answer (free first-pass overview; verify material claims with web_search and read_url):",
        `Query: ${answer.query}`,
    ];
    if (answer.answer) lines.push(`Answer: ${answer.answer}`);
    if (answer.abstractText) {
        lines.push(
            `Abstract${answer.abstractSource ? ` (${answer.abstractSource})` : ""}: ${answer.abstractText}`,
        );
    }
    if (answer.abstractUrl) lines.push(`Abstract URL: ${answer.abstractUrl}`);
    if (answer.definition) {
        lines.push(
            `Definition${answer.definitionSource ? ` (${answer.definitionSource})` : ""}: ${answer.definition}`,
        );
    }
    if (answer.definitionUrl) lines.push(`Definition URL: ${answer.definitionUrl}`);
    if (answer.relatedTopics.length > 0) {
        lines.push(
            "Related topics:\n" +
                answer.relatedTopics
                    .map(
                        (topic, index) =>
                            `[${index + 1}] ${topic.title}\nURL: ${topic.url}\nSnippet: ${topic.snippet}`,
                    )
                    .join("\n\n"),
        );
    }
    if (lines.length === 2) {
        lines.push(
            "No instant answer was available. Use web_search, third-party search, and read_url instead.",
        );
    }
    return lines.join("\n").slice(0, 8_000);
}

function researchSkillGuide(input: {
    question: string;
    depth?: "quick" | "standard" | "deep";
    context?: string;
}): string {
    return `# Research Skill

Research question: ${input.question.trim()}
Depth: ${input.depth || "standard"}
Known context (treat as unverified until confirmed): ${input.context?.trim() || "none provided"}

## Mission
Answer the question with live, verifiable evidence. Your training data, knowledge cutoff, and saved local memory are not evidence. Every material claim must trace to a source you actually retrieved in this session.

## Before searching
1. Define the answerable core: what must be true for the answer to be reliable.
2. Split the question into 2-5 subquestions; each subquestion gets at least one focused query.
3. For definitions, entities, concepts, and broad factual overviews, call duckduckgo_instant_answer first. Treat its output as a fast discovery/overview layer, not as proof or a substitute for a retrieved primary page.
4. Design queries per subquestion using exact phrases ("quoted term"), site restriction (site:docs.example.com), file type (filetype:pdf for primary documents), date terms (e.g. 2026) for freshness, and synonym variants when results are thin.
5. Classify how fast the facts change:
   - Volatile (prices, releases, incidents, live status, schedules): use the newest sources and cross-check within the session.
   - Stable (documentation, APIs, history, specs): verify against the primary source and note its date.
   - Subjective or contested: sample multiple perspectives and report the range.

## Depth behavior
- Quick: use duckduckgo_instant_answer when applicable, then 1-3 focused queries; verify the direct answer with one authoritative source plus one independent check when the claim is consequential.
- Standard: use the Instant Answer overview when applicable, cover every subquestion, read the top pages with read_url, and cross-check every claim that materially affects the answer with two independent sources.
- Deep: use all relevant discovery layers, including Instant Answer, traditional search, third-party providers, and primary-source reads; use multiple query families and an explicit disagreement table with dates.

## Evidence rules
1. Prefer primary and official sources: official documentation, specifications, standards bodies, original research, direct datasets, maintained repositories, and primary reporting. Treat forums, blogs, and unknown domains as weak evidence.
2. A search snippet is a lead, not evidence. Read the page with read_url before quoting numbers, dates, or claims; extract the exact sentence and the stable source URL.
3. Check each source's date: is it the newest relevant document, and does it claim to be current?
4. Consequential claims (safety, financial, legal, medical, identity, versions, API behavior) require two independent credible sources, or one primary source you verified directly.
5. If sources disagree, report the disagreement explicitly with dates and source types; never silently average them or pick the one that fits.

## Anti-hallucination
- Cite only URLs that actually appeared in tool results. Never construct or guess URLs.
- Never invent quotes, numbers, dates, authors, or sources. If you could not read the page, say so.
- Distinguish "stated by source X" from "verified fact".
- If a search returns nothing usable, change the query or state that the answer could not be verified. Do not fall back to training data or memory.

## Synthesis
1. Answer the exact question first, in 1-3 sentences.
2. Support the answer with key findings; each finding cites a source and, when useful, its date.
3. Label confidence per claim: High (primary source or two independent credible sources), Medium (single reputable source), Low (unverified or conflicting).
4. State remaining gaps or what would change the answer.

## Output contract
- Answer first; evidence after.
- Bullet findings with inline source URLs; keep the answer as concise as accuracy allows.
- End with confidence labels and unresolved uncertainty only when relevant.
- Do not narrate searches or expose private reasoning.`;
}

function pythonFileCreationSkill(input: { task?: string }): string {
    return `# Python File Creation & Execution Skill

Task: ${input.task?.trim() || "Create, validate, and deliver a file with browser Python."}

## Purpose
Create real, downloadable files with browser-side Pyodide. Use this skill before non-trivial DOCX, XLSX, PPTX, PDF, image, archive, or data-file work.

## Execution contract
1. Call run_python with ordinary Python code. Listed libraries are loaded lazily when imported; never run pip, micropip, subprocess, or asyncio.run yourself.
2. Top-level await is supported. For async work, use await directly rather than asyncio.run.
3. Save each requested output in the current working directory using a clear filename such as report.docx, budget.xlsx, slides.pptx, or invoice.pdf. Do not write to a custom directory unless required.
4. The browser automatically captures up to four newly created or changed files, each up to 2 MiB, into Canvas for the current browser session. Binary bytes are never persisted to browser storage.
5. When run_python reports a created artifact, it is already downloadable in Canvas. Do not call create_file, generate_file, or manually Base64/hex encode the same file. Never hand-build a DOCX/XLSX/PPTX ZIP/XML package.
6. Validate before finishing: reopen the file with the library when practical, check the target file exists and has non-zero size, and print a concise confirmation with filename and byte count.

## Verified libraries
- Word: from docx import Document (python-docx)
- Excel: import openpyxl or import xlsxwriter
- PowerPoint: from pptx import Presentation
- PDF: from reportlab.pdfgen import canvas or from fpdf import FPDF
- Images: from PIL import Image, ImageDraw
- Charts: import matplotlib.pyplot as plt
- Data: import pandas as pd, csv, json, zipfile

## Standard workflow
1. Infer the required format, filename, audience, and content structure from the request. Ask only if a missing detail changes the output materially.
2. Use the format's real library and create semantic content: headings/tables/styles for documents, typed cells/formulas for spreadsheets, slides/layouts for presentations, and page structure for PDFs.
3. Save once to the requested filename in the working directory.
4. Verify with os.path.getsize and, where appropriate, reload or inspect the artifact.
5. Let the automatic Canvas artifact capture deliver the file. Respond with the artifact name and a concise summary of what it contains.

## Failure recovery
- Import failure: rerun the same normal import; the browser loader installs supported packages lazily. Do not attempt manual package management.
- File exceeds 2 MiB or more than four files are created: reduce/compress output, create only the requested deliverable, or explain that the user should download/export in smaller parts.
- Python error: fix the actual traceback and rerun. Do not claim a file exists unless run_python reported it.
- Missing Canvas artifact: confirm the file was saved in the current working directory and has non-zero bytes, then rerun only the creation step.

## Delivery contract
- Do not fabricate download links or previews.
- State the exact captured filename and its purpose.
- Clearly distinguish a verified generated file from an unverified claim.
- Keep binary file bytes out of chat text and out of saved memory.`;
}

export async function buildChatTools(settings: ToolSettings = {}) {
    const enableSearch = settings.webSearchEnabled !== false;
    const enableCalc = settings.calculatorEnabled !== false;
    // Python is a client-side tool. The browser executes it in Pyodide and
    // sends the result back before the model continues.
    const enablePython = settings.pythonEnabled !== false;

    const tools: Record<string, Tool> = {};

    if (enableSearch) {
        tools.duckduckgo_instant_answer = tool({
            description:
                "Use DuckDuckGo's free Instant Answer API as the first-pass research tool for definitions, entities, concepts, and broad factual overviews. It is fast and useful but is not an LLM and is not proof by itself. For current, consequential, disputed, or source-sensitive claims, follow with web_search or a configured third-party provider and read_url/fetch_url to verify authoritative pages. This service is intended for non-commercial use; review current DuckDuckGo terms before commercial deployment.",
            inputSchema: z.object({
                query: z.string(),
                maxRelatedTopics: z.number().int().min(0).max(8).optional(),
            }),
            execute: async ({ query, maxRelatedTopics }) => {
                try {
                    return formatDuckDuckGoInstantAnswer(
                        await duckDuckGoInstantAnswer(query, maxRelatedTopics ?? 5),
                    );
                } catch (err) {
                    return `DuckDuckGo Instant Answer unavailable: ${err instanceof Error ? err.message : "the service failed"}. Continue with web_search and read_url.`;
                }
            },
        });
        tools.research_skill = tool({
            description:
                "Callable research skill. Invoke before substantial factual, current, technical, or comparison research: it defines subquestions, a query strategy, source-quality and verification rules, and an output contract for live, source-verified research. Then run its planned queries with the search tool and read pages with read_url.",
            inputSchema: z.object({
                question: z.string(),
                depth: z.enum(["quick", "standard", "deep"]).optional(),
                context: z.string().optional(),
            }),
            execute: async (input) => researchSkillGuide(input),
        });
    }

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
        const activeConnector = settings.connectors?.find(
            (connector) =>
                connector.enabled &&
                Boolean(connector.apiKey?.trim()) &&
                ["tavily", "brave", "exa", "parallel"].includes(connector.kind),
        );
        const engineLabel =
            activeConnector?.name ||
            (engine === "searxng" && settings.searxngUrl?.trim()
                ? "SearXNG"
                : "DuckDuckGo");

        const formatResults = (results: Awaited<ReturnType<typeof webSearch>>) =>
            results.length
                ? results
                      .map(
                          (result, index) =>
                              `[${index + 1}] ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet}`,
                      )
                      .join("\n\n")
                : "No results found.";

        const builtInSearch = async (query: string, maxResults: number) =>
            formatResults(
                await webSearch(query, {
                    maxResults,
                    engine,
                    searxngUrl: settings.searxngUrl,
                }),
            );

        const searchTool = tool({
            description: `Search the web using ${engineLabel} for real-time information, facts, news, and technical topics. Cite result URLs.`,
            inputSchema: z.object({
                query: z.string().optional(),
                maxResults: z.number().optional(),
            }),
            execute: async ({ query, maxResults }) => {
                const normalizedQuery = query?.trim();
                if (!normalizedQuery) {
                    return "Search query required. Retry with a focused query string.";
                }
                try {
                    const results = activeConnector
                        ? await connectorSearch(activeConnector, normalizedQuery, maxResults ?? 5)
                        : await webSearch(normalizedQuery, {
                              maxResults: maxResults ?? 5,
                              engine,
                              searxngUrl: settings.searxngUrl,
                          });
                    return formatResults(results);
                } catch (err) {
                    if (activeConnector) {
                        try {
                            return `${await builtInSearch(normalizedQuery, maxResults ?? 5)}\n\nNote: ${activeConnector.name} was unavailable, so built-in web search was used instead.`;
                        } catch {
                            // Return a model-readable result instead of failing the stream.
                        }
                    }
                    return `Search unavailable: ${err instanceof Error ? err.message : "the search provider failed"}`;
                }
            },
        });
        tools[activeConnector ? `${activeConnector.kind}_search` : "web_search"] = searchTool;
        if (activeConnector) {
            tools.web_search = tool({
                description:
                    "Built-in web search fallback. Use this when the configured provider search connector is unavailable.",
                inputSchema: z.object({
                    query: z.string().optional(),
                    maxResults: z.number().optional(),
                }),
                execute: async ({ query, maxResults }) => {
                    const normalizedQuery = query?.trim();
                    if (!normalizedQuery) {
                        return "Search query required. Retry with a focused query string.";
                    }
                    try {
                        return await builtInSearch(normalizedQuery, maxResults ?? 5);
                    } catch (err) {
                        return `Search unavailable: ${err instanceof Error ? err.message : "the built-in provider failed"}`;
                    }
                },
            });
        }

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
        tools.read_url = tools.fetch_url;
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
        tools.calculate = tools.calculator;
    }

    if (enablePython) {
        tools.run_python = tool({
            description:
                "Execute Python 3 in the browser with Pyodide and return stdout, stderr, or error logs. Every listed library auto-loads on first import; simply import it and never manage package installation yourself with micropip, pip, or subprocess. Top-level await is supported; do not use asyncio.run (Pyodide already runs inside an event loop), just write await at top level. Data/analysis: numpy, pandas, scipy, sympy, scikit-learn, networkx. Plotting: matplotlib. Parsing: BeautifulSoup, lxml, regex, python-dateutil, pyyaml. File creation: openpyxl and xlsxwriter (Excel), python-docx (Word), python-pptx (PowerPoint), reportlab and fpdf2 (PDF), pillow (images), jinja2 (templates), requests (HTTP), plus the csv, json, and zipfile standard libraries. Always use these real libraries instead of hand-rolling zip/XML files. Save generated files in the current working directory; the browser captures up to four new files of 2 MiB each as session-only downloadable Canvas artifacts and never persists their binary data to browser storage. When a result reports created artifacts, do not call create_file or copy/Base64 their bytes again.",
            inputSchema: z.object({
                code: z.string(),
                description: z.string().optional(),
            }),
        });
        tools.run_code = tools.run_python;
    }

    if (enablePython && settings.skillsEnabled !== false) {
        const pythonFileSkill = tool({
            description:
                "Callable Python file-creation and execution skill. Invoke before non-trivial DOCX, XLSX, PPTX, PDF, image, archive, or data-file work. It defines the verified Pyodide library, direct Canvas artifact-capture, validation, size-limit, and failure-recovery protocol.",
            inputSchema: z.object({ task: z.string().optional() }),
            execute: async (input) => pythonFileCreationSkill(input),
        });
        tools.python_file_creation_skill = pythonFileSkill;
        tools.file_creation_skill = pythonFileSkill;
    }

    tools.get_current_time = tool({
        description: "Return the current ISO date/time in a requested IANA timezone.",
        inputSchema: z.object({ timezone: z.string().optional() }),
        execute: async ({ timezone }) => {
            const now = new Date();
            return JSON.stringify({
                iso: now.toISOString(),
                timezone: timezone || "UTC",
                readable: now.toLocaleString("en-US", { timeZone: timezone || "UTC" }),
            });
        },
    });

    if (settings.memoryAvailable) {
        tools.memory = tool({
            description:
                "Read relevant user-approved local memory from the browser. Use only when it can improve the answer; never infer or invent memories and never request credentials or secrets.",
            inputSchema: z.object({
                query: z.string().optional(),
            }),
        });
    }

    tools.list_connections = tool({
        description: "List enabled integrations and their capability categories without exposing credentials.",
        inputSchema: z.object({}),
        execute: async () =>
            JSON.stringify(
                (settings.connectors ?? [])
                    .filter((connector) => connector.enabled)
                    .map((connector) => ({
                        name: connector.name,
                        kind: connector.kind,
                        capabilities: connector.kind === "remote-mcp" ? ["discovered tools"] : ["configured connector"],
                    })),
            ),
    });

    tools.ask_user = tool({
        description: "Ask the user a focused multiple-choice, multi-select, or short-answer question when required information cannot be safely inferred.",
        inputSchema: z.object({
            question: z.string(),
            questionType: z.enum(["single", "multiple", "short"]).default("short"),
            options: z.array(z.string()).max(8).optional(),
        }),
    });

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
            "Create a document, code file, SVG, interactive HTML preview, or downloadable binary file in the Canvas panel. For binary bytes produced by run_python, pass the exact Base64 or hex string with contentEncoding set to base64 or hex; the client decodes it before download. Always use this tool for a file the user asked to download and cite the resulting file.",
        inputSchema: z.object({
            filename: z.string(),
            title: z.string(),
            content: z.string(),
            kind: z.string(),
            mimeType: z.string().optional(),
            contentEncoding: z.enum(["base64", "hex"]).optional(),
        }),
        execute: async ({ title, filename, content, kind, mimeType, contentEncoding }) =>
            artifactPayload({ title, filename, content, kind, mimeType, contentEncoding }),
    });

    tools.generate_file = tool({
        description:
            "Generate a downloadable text/data/code file from content and cite it in the response. Use this for CSV, JSON, Markdown, TXT, SVG, HTML, or source code when the user asks for a file. Do not call this for an image or binary file already created by run_python; do not Base64-encode and duplicate a Python-created file. For data-heavy text files, use run_python first, then pass the resulting text here.",
        inputSchema: z.object({
            filename: z.string(),
            title: z.string(),
            content: z.string(),
            kind: z.string(),
            mimeType: z.string().optional(),
            contentEncoding: z.enum(["base64", "hex"]).optional(),
        }),
        execute: async ({ title, filename, content, kind, mimeType, contentEncoding }) => {
            if (
                mimeType?.startsWith("image/") ||
                /^(image|binary|blob)/i.test(kind) ||
                /\.(png|jpe?g|gif|webp|bmp|ico|pdf|zip)$/i.test(filename)
            ) {
                return "No duplicate artifact was generated. The binary/image file was already created by run_python; do not Base64-encode it again unless the user explicitly asks for a separate downloadable copy.";
            }
            return artifactPayload({ title, filename, content, kind, mimeType, contentEncoding });
        },
    });

    return tools;
}
