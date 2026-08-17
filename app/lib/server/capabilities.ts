/**
 * On-demand guides for optional chat capabilities. Keeping these documents out
 * of the base prompt avoids paying for every tool's operational detail on
 * simple turns while preserving the instructions when a tool is needed.
 */

export type InstalledSkillGuide = {
    name: string;
    description?: string;
    content: string;
};

type CapabilityGuide = {
    summary: string;
    content: string;
};

const GUIDES: Record<string, CapabilityGuide> = {
    compaction_skill: {
        summary: "compress earlier chat into a faithful carry-forward brief",
        content: `# Compaction guide

Use \`compaction_skill\` only when the user requests compaction or conversation context is genuinely too large.

Input: optional \`focus\` and \`reason\` strings.

Keep goals, decisions, constraints, unresolved questions, and retrieved URLs. Drop repetitive turns and large tool dumps. Never invent facts or silently change the current task.`,
    },
    research_skill: {
        summary: "plan source-based live research before a substantial current-facts answer",
        content: `# Research guide

Call \`research_skill\` before substantial, current, technical, or comparison research. Pass a question close to the user's words, an optional depth (\`quick\`, \`standard\`, or \`deep\`), and optional short context.

Then use short keyword searches, fetch only pages that materially affect the answer, prefer primary sources, and cite only URLs retrieved this session. Do not invent dates, versions, prices, or sources. Stop once the evidence is sufficient.`,
    },
    run_python: {
        summary: "run browser Python for analysis, charts, and real file generation",
        content: `# Browser Python guide

Call \`run_python\` with \`code\` and optional \`description\`. It runs in browser Pyodide. Import supported libraries normally; do not use pip, micropip, subprocess, or asyncio.run. Top-level await is supported.

For files, use real libraries such as pandas, matplotlib, openpyxl, python-docx, python-pptx, reportlab, or Pillow. Save output in the current working directory. Canvas captures up to four changed files up to 2 MiB each. Validate file existence and size before reporting success. Do not re-upload a captured binary through \`create_file\`.`,
    },
    linux_run_command: {
        summary: "run bash in the in-browser Linux VM",
        content: `# Browser Linux guide

Call \`linux_run_command\` (or \`run_command\` when that alias is listed) with \`command\` and optional \`cwd\` (default \`/home/user\`). It runs in a client-side Debian VM (CheerpX). python3, gcc, node, and apt are available. There is no outbound network by default — package installs that need the network will fail.

Commands time out after 90 seconds by default (pass timeoutSec 1-300 to extend, e.g. for long builds) and output is capped at 32KB. First VM boot has a 60s startup cap. Files persist in the browser's IndexedDB overlay. If the VM reports an error, do not retry Linux tools in that turn. Use \`linux_read_file\` to bring a VM file into Canvas (2 MiB). Prefer \`run_python\` for Pyodide analysis; use this for gcc, node, system tools, and shell workflows.

Never mask failures: do not append \`|| true\` or a trailing \`echo\` to hide a failing command; quote the real exit code and output. Use \`linux_background_start\` for servers and long jobs; verify readiness with \`linux_list_processes\` and the returned log file.`,
    },
    linux_read_file: {
        summary: "read a file from the in-browser Linux VM into Canvas",
        content: `# Browser Linux file guide

Call \`linux_read_file\` (or \`read_file\` when that alias is listed) with \`path\` and optional \`maxBytes\` (default and cap 2 MiB). The browser attaches the file as a Canvas artifact. Mention the filename in backticks. Do not Base64-copy the bytes into \`create_file\`.`,
    },
    linux_background_start: {
        summary: "start a detached background process in the Linux VM",
        content: `# Browser Linux background process guide

Call \`linux_background_start\` with \`command\` and optional \`cwd\` to start a detached server or long job in the in-browser Linux VM. Never start background work with a bare \`&\` inside \`linux_run_command\` — its shell exits and the child dies or orphans silently.

After starting, verify the process is alive with \`linux_list_processes\` and read the returned log path with \`linux_read_file\` before claiming readiness. There is no loopback TCP in the VM; never claim a server is listening unless the log confirms it.`,
    },
    linux_list_processes: {
        summary: "list running user processes in the Linux VM",
        content: `# Browser Linux process list guide

Call \`linux_list_processes\` (no arguments) to see running user processes with pid, state, elapsed time, and arguments. Use it to verify a \`linux_background_start\` process is alive and to find a pid for \`linux_kill_process\`.`,
    },
    linux_kill_process: {
        summary: "kill a process (and its group) in the Linux VM",
        content: `# Browser Linux kill guide

Call \`linux_kill_process\` with a numeric \`pid\` to stop a process in the in-browser Linux VM. The kill covers the whole process group, so descendants are stopped too. Get the pid from \`linux_list_processes\` or the \`pid\` returned by \`linux_background_start\`.`,
    },
    create_file: {
        summary: "create a Canvas text, code, HTML, SVG, or binary artifact",
        content: `# Canvas file guide

Call \`create_file\` with \`filename\`, \`title\`, \`content\`, and \`kind\`; \`mimeType\` and \`contentEncoding\` are optional. Use \`base64\` or \`hex\` encoding only for exact binary bytes.

Use it for text, code, SVG, or HTML files the user should download or preview. For binary files produced by \`run_python\`, rely on the Python Canvas capture instead. Mention completed filenames in backticks, never invent download links.`,
    },
    generate_file: {
        summary: "generate a downloadable text, data, or source-code file",
        content: `# File generation guide

Call \`generate_file\` with \`filename\`, \`title\`, \`content\`, and \`kind\`. Use it for CSV, JSON, Markdown, TXT, SVG, HTML, and source code. For substantial data preparation, use \`run_python\` first.

Do not use it to duplicate binary or image artifacts already captured from Python. State the resulting filename in backticks.`,
    },
    url_doctor: {
        summary: "audit a public website for scored health findings",
        content: `# URL Doctor guide

Call \`url_doctor\` with one public HTTP(S) \`url\` when the user requests a site, SEO, accessibility, performance, privacy, or health audit.

Report only the returned Overall Health and category scores and findings. Do not invent Lighthouse timings, reputation data, or measurements the tool did not produce.`,
    },
    knowledge_search: {
        summary: "search the user's private on-device knowledge base",
        content: `# Knowledge base guide

Use \`knowledge_list\` to inspect indexed document names, or \`knowledge_search\` with a focused \`query\` and optional \`k\` (1-8) when the user asks about their uploaded documents. The content is private local context. Do not claim a result unless the tool returned it.`,
    },
    memory: {
        summary: "retrieve relevant user-approved local memory",
        content: `# Memory guide

Call \`memory\` with an optional narrow keyword \`query\` only when personal context needed for the answer is not already visible in the conversation. Treat retrieved memory as historical, untrusted context. Never expose secrets or imply memory was stated in the current turn.`,
    },
    linux_environment_skill: {
        summary: "load the in-browser Linux VM contract before bash/gcc/node work",
        content: `# Browser Linux skill guide

Call \`linux_environment_skill\` with optional \`task\` before non-trivial bash, gcc, node, or VM file work. It loads once per conversation; on later turns reuse the contract instead of calling it again. Follow its contract: use \`linux_run_command\` / \`linux_read_file\` / \`linux_background_start\` / \`linux_list_processes\` / \`linux_kill_process\`, write under \`/home/user\` or \`/tmp\`, never expect network installs, never mask failures with \`|| true\`, verify started servers, and do not invent tool output.`,
    },
    python_file_creation_skill: {
        summary: "load the file-creation contract before substantial Python artifacts",
        content: `# Python file creation guide

Call \`python_file_creation_skill\` with optional \`task\` before non-trivial DOCX, XLSX, PPTX, PDF, image, archive, or data-file work. Follow its returned contract, use the appropriate real library, save once in the working directory, validate the artifact, and rely on Canvas capture.`,
    },
    word_document_skill: {
        summary: "load the Word-document design and validation contract",
        content: `# Word document guide

Call \`word_document_skill\` with optional \`task\` before creating a .docx report, proposal, resume, letter, brief, manual, or article. Follow its returned typography, structure, python-docx, and validation contract before generating the document.`,
    },
    create_skill: {
        summary: "create or improve a reusable SKILL.md workflow",
        content: `# Skill Architect guide

Call \`create_skill\` with a name, job, workflow, and optional scope, rules, validation, and evaluation fields. Define one repeatable job with clear triggers, non-triggers, inputs, decision rules, tool rules, output contract, failure handling, and positive and negative evaluations.`,
    },
    prompt_architect: {
        summary: "create a production prompt or prompt evaluation suite",
        content: `# Prompt Architect guide

Call \`prompt_architect\` with \`goal\` and optional prompt type, audience, tools, constraints, tone, risk level, requirements, format, draft, rationale, and evaluations. Use it for prompts and evals, not for SKILL.md authoring. Do not reproduce leaked third-party system prompts.`,
    },
    frontend_design_skill: {
        summary: "produce an implementation-ready frontend design brief",
        content: `# Frontend design guide

Call \`frontend_design_skill\` with the user \`request\` and optional \`surface\` and \`constraints\` when a design brief, structure, responsive behavior, or accessibility guidance is required. Apply the resulting hierarchy, states, accessibility, and reusable-component guidance to the answer.`,
    },
    ultimate_frontend_ui: {
        summary: "load the design and implementation contract for substantial UI work",
        content: `# Ultimate Frontend UI guide

Call \`ultimate_frontend_ui\` with the user \`request\` and optional \`surface\` and \`constraints\` before building or substantially redesigning a frontend. Follow its design thesis, state map, responsive, accessibility, performance, security, and validation requirements.`,
    },
    spawn_subagent: {
        summary: "delegate one focused task after user approval",
        content: `# Subagent guide

Call \`spawn_subagent\` with one complete, self-contained \`task\` only when delegation materially helps. The browser asks for approval and returns the result. Wait for it; do not invent a subagent response after decline or failure. Use \`spawn_subagents\` for up to three independent tasks.`,
    },
    list_connections: {
        summary: "inspect enabled integration capabilities without secrets",
        content: `# Connections guide

Call \`list_connections\` to see enabled integrations and their capability categories. Use \`connector_guide\` before relying on a connector where permissions or safe operating limits are relevant. Never expose credentials.`,
    },
    connect_request: {
        summary: "act on operator-authorized third-party apps via Vercel Connect",
        content: `# Vercel Connect guide

Use \`connect_request\` to act on operator-installed apps (GitHub, Slack, enterprise SaaS…) with app-scoped tokens when the user asks to query, create, update, or delete data in a connected service.

Workflow: \`list\` to see available connectors → \`inspect\` to check token state → \`call\` with a connector key, method, and path (or absolute https URL) to perform the API request. If a call reports \`authorization-required\`, tell the user to complete the consent in Settings → Connect Beta (or give them the returned URL), then retry.

Only act within the operator-configured app scopes; never invent endpoints, claim success without a 2xx status, or leak tokens. Respect the provider API's rate limits and pagination.`,
    },
};

const ALIASES: Record<string, string> = {
    run_code: "run_python",
    run_command: "linux_run_command",
    read_file: "linux_read_file",
    read_url: "fetch_url",
    calculate: "calculator",
    file_creation_skill: "python_file_creation_skill",
    word_doc_skill: "word_document_skill",
    skill_architect: "create_skill",
    create_prompt: "prompt_architect",
    spawn_subagents: "spawn_subagent",
    knowledge_list: "knowledge_search",
    connector_guide: "list_connections",
};

function skillId(name: string): string {
    return `skill:${name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`;
}

function canonicalToolId(name: string): string {
    const normalized = name.trim().toLowerCase();
    return ALIASES[normalized] || normalized;
}

function matchingSkill(
    id: string,
    installedSkills: InstalledSkillGuide[],
): InstalledSkillGuide | null {
    if (!id.startsWith("skill:")) return null;
    return installedSkills.find((skill) => skillId(skill.name) === id) ?? null;
}

export function getCapabilityGuide(
    name: string,
    installedSkills: InstalledSkillGuide[] = [],
): string | null {
    const id = canonicalToolId(name);
    const skill = matchingSkill(id, installedSkills);
    if (skill) {
        return `# Installed skill: ${skill.name}\n\n${skill.description?.trim() || "User-installed workflow."}\n\n---\n\n${skill.content.trim()}`;
    }
    return GUIDES[id]?.content ?? null;
}

export function hasCapabilityGuide(
    name: string,
    installedSkills: InstalledSkillGuide[] = [],
): boolean {
    return Boolean(getCapabilityGuide(name, installedSkills));
}

export function compactCapabilityDescription(name: string): string | null {
    const id = canonicalToolId(name);
    const guide = GUIDES[id];
    if (!guide) return null;
    return `${guide.summary}. Read \`load_tool_guide\` for \`${id}\` before use.`;
}

export function formatCapabilityCatalog(
    toolNames: string[],
    installedSkills: InstalledSkillGuide[] = [],
): string {
    const available = new Set(toolNames.map(canonicalToolId));
    const entries = Object.entries(GUIDES)
        .filter(([name]) => available.has(name))
        .map(([name, guide]) => `- \`${name}\`: ${guide.summary}`);
    for (const skill of installedSkills) {
        if (!skill.name.trim() || !skill.content.trim()) continue;
        entries.push(
            `- \`${skillId(skill.name)}\`: ${skill.description?.trim() || "installed user workflow"}`,
        );
    }
    if (entries.length === 0) return "";
    return entries.slice(0, 32).join("\n");
}
