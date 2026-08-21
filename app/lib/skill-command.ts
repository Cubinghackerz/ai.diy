/**
 * Skill command store — typed "/" command in the composer.
 *
 * Picking skills from the slash menu marks them as forced: the next chat
 * request carries them as `customSkills` so the server appends them to the
 * system prompt and hard-requires the matching skill tool on early steps.
 */

export type ForcedSkill = {
    name: string;
    content: string;
};

export function normalizeForcedSkillName(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Keep the first skill definition so built-ins win over duplicate installs. */
export function dedupeForcedSkills(skills: ForcedSkill[]): ForcedSkill[] {
    const seen = new Set<string>();
    return skills.filter((skill) => {
        const key = normalizeForcedSkillName(skill.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export const forcedSkillStore: { current: ForcedSkill[] } = {
    current: [],
};

/** Built-in skills that can be force-selected without custom content. */
export const BUILTIN_FORCED_SKILLS: ForcedSkill[] = [
    {
        name: "Research",
        content:
            "You MUST handle this request with the research_skill: call research_skill first with a question close to the user's words (do not invent years/vendors/scope). Then run only short keyword searches (3–10 words) and fetch primary pages. Do not rely on training data for time-sensitive facts. Cite retrieved URLs and report confidence. Do not answer before calling research_skill.",
    },
    {
        name: "Compaction",
        content:
            "You MUST activate and follow the compaction_skill for this request: call the compaction_skill tool first to compress prior conversation into a faithful carry-forward brief (goals, decisions, constraints, open threads, cited URLs). Do not invent details that are not in the source turns. After compaction, continue from the brief plus the recent messages, and keep using the active tools available this turn. Do not answer before calling compaction_skill.",
    },
    {
        name: "HTML Craft",
        content:
            "You MUST activate and follow the html_craft skill for this request before writing frontend code: call the html_craft tool first, then apply its design thesis, typography and color system, layout rules, interaction states, responsive/accessibility/performance gates, and preflight validation. Adapt the contract to the existing framework when the user is working in a React app. Do not answer before calling html_craft.",
    },
    {
        name: "Python File Creation",
        content:
            "You MUST activate and follow the python_file_creation_skill for this request before creating any file: call the python_file_creation_skill tool, then create the deliverable with browser Pyodide using the verified libraries, save it in the current working directory, validate it, and rely on direct Canvas artifact capture. Do not create files before calling python_file_creation_skill.",
    },
    {
        name: "Word Document",
        content:
            "You MUST activate and follow the word_document_skill for this request before creating any document: call the word_document_skill tool, then produce the .docx deliverable with browser Pyodide (python-docx) following its design contract (cover page, typography, color, section layout, page numbers, tables), save it in the current working directory, validate it, and rely on direct Canvas artifact capture. Do not create documents before calling word_document_skill.",
    },
    {
        name: "Skill Architect",
        content:
            "You MUST activate and follow the skill_architect contract for this request: call the create_skill tool and produce a complete SKILL.md with job charter, activation boundaries, inputs, workflow, decision rules, tool rules, output contract, validation, failure handling, and positive/negative evaluation cases. Do not answer before calling create_skill.",
    },
    {
        name: "Prompt Architect",
        content:
            "You MUST activate and follow the prompt-engineering skill for this request: call prompt_architect (or create_prompt) first with structured fields (goal, promptType, audience, tools, constraints, tone, riskLevel, mustInclude, mustAvoid, format). Prefer passing a refined draft when you have one. Produce a production-quality prompt with design rationale and eval suite; never paste third-party leaked system prompts; hand off Prismium SKILL.md requests to create_skill. Do not answer before calling prompt_architect.",
    },
    {
        name: "Subagent",
        content:
            "You MUST use subagents for this request. Call spawn_subagents (preferred for 1–3 independent slices) or spawn_subagent for one focused slice BEFORE answering. The browser will pause for user approval, then run each subagent to completion; you MUST wait for that tool result (do not keep answering as if it finished early). After results return, synthesize Status: complete outputs; for Status: declined/cancelled/error, continue yourself or note the gap — never invent what a failed subagent would have said.",
    },
    {
        name: "YouTube",
        content:
            "You MUST activate youtube_transcript for this request: call youtube_transcript first with the YouTube URL, then summarize or quote only from the returned title, channel, and transcript/description. Do not invent captions. Do not answer before calling youtube_transcript.",
    },
    {
        name: "URL Doctor",
        content:
            "You MUST activate URL Doctor for this request: call url_doctor first with the public http(s) URL the user wants audited (AuditURL). Present the returned Overall Health and category scores (Security, Performance, SEO, Accessibility, Privacy/Tracking, Links, Conversion, Reputation/risk) with findings. Do not invent Lighthouse/Lab timings or reputation feeds that were not measured. Do not answer before calling url_doctor.",
    },
    {
        name: "Linux Environment",
        content:
            "You MUST activate and follow the linux_environment_skill contract for this request before using the in-browser Linux VM: load the contract once (call linux_environment_skill, or reuse it if it is already loaded in this conversation), then use linux_run_command / linux_read_file (or run_command / read_file when those aliases are listed), linux_background_start / linux_list_processes / linux_kill_process for servers and long jobs. Never mask failures with `|| true`; quote real exit codes and output; verify started servers via linux_list_processes and the returned log. Do not invent exit codes, Canvas files, or compiler output. Do not answer before loading the contract.",
    },
    {
        name: "NPM Project",
        content:
            "You MUST activate and follow the npm_project_skill before building a project that needs npm packages or Node libraries: call npm_project_skill first, then use npm_project for init, write, install, run, preview, inspect, read, or export. Work only in the browser-local WebContainer project workspace. Install public registry packages with exact versions when practical; lifecycle scripts are disabled by default. For app/project requests, export the verified project by default unless the user explicitly says not to create, download, or export files. Use preview when a dev/start/preview script exists. Do not run npm on the ai.diy server, use git/file/tarball package specs, place files outside the project root, expose secrets, or claim a preview/build succeeded without reading the real result.",
    },
];

/** Search aliases for the slash skill menu (name + shortcuts). */
const SKILL_MENU_ALIASES: Record<string, string[]> = {
    research: ["research", "web research", "search"],
    compaction: ["compaction", "compact", "compress", "context", "shrink"],
    "html craft": [
        "html craft",
        "html",
        "frontend design",
        "ultimate frontend ui",
        "frontend ui",
        "ui",
        "web design",
    ],
    "python file creation": ["python file creation", "python", "file"],
    "word document": ["word document", "word", "docx"],
    "skill architect": ["skill architect", "skill", "architect"],
    "prompt architect": [
        "prompt architect",
        "prompt",
        "prompts",
        "prompt engineering",
        "system prompt",
        "prompt engineer",
    ],
    subagent: ["subagent", "subagents", "delegate", "fanout", "fan-out", "parallel"],
    youtube: ["youtube", "yt", "video", "transcript", "summarize video"],
    "url doctor": [
        "url doctor",
        "auditurl",
        "audit url",
        "url audit",
        "site audit",
        "seo audit",
        "page health",
    ],
    "linux environment": [
        "linux environment",
        "linux",
        "cheerpx",
        "webvm",
        "bash",
        "gcc",
        "sandbox",
    ],
    "npm project": [
        "npm project",
        "npm",
        "node project",
        "node app",
        "package",
        "packages",
        "dependency",
        "dependencies",
        "library",
        "libraries",
        "vite",
    ],
};

/** Whether a skill should appear for the current `/query` filter. */
export function skillMatchesSlashQuery(skillName: string, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const name = skillName.toLowerCase();
    if (name.includes(q) || q.includes(name)) return true;
    const aliases = SKILL_MENU_ALIASES[name] ?? [];
    return aliases.some((alias) => alias.includes(q) || q.includes(alias));
}

/** Map forced skill display names (and aliases) to callable tool ids. */
const SKILL_TOOL_BY_NAME: Record<string, string> = {
    research: "research_skill",
    "research skill": "research_skill",
    "web research": "research_skill",
    "html craft": "html_craft",
    html: "html_craft",
    "frontend design": "html_craft",
    "ultimate frontend ui": "html_craft",
    "python file creation": "python_file_creation_skill",
    "word document": "word_document_skill",
    "skill architect": "create_skill",
    "prompt architect": "prompt_architect",
    "prompt engineering": "prompt_architect",
    "prompt-engineering": "prompt_architect",
    compaction: "compaction_skill",
    "context compaction": "compaction_skill",
    compress: "compaction_skill",
    subagent: "spawn_subagents",
    subagents: "spawn_subagents",
    youtube: "youtube_transcript",
    yt: "youtube_transcript",
    "summarize youtube": "youtube_transcript",
    "url doctor": "url_doctor",
    auditurl: "url_doctor",
    "audit url": "url_doctor",
    "url audit": "url_doctor",
    "site audit": "url_doctor",
    "linux environment": "linux_environment_skill",
    linux: "linux_environment_skill",
    cheerpx: "linux_environment_skill",
    webvm: "linux_environment_skill",
    "npm project": "npm_project_skill",
    npm: "npm_project_skill",
    "node project": "npm_project_skill",
    "node app": "npm_project_skill",
    package: "npm_project_skill",
    packages: "npm_project_skill",
    dependency: "npm_project_skill",
    dependencies: "npm_project_skill",
    library: "npm_project_skill",
    libraries: "npm_project_skill",
    vite: "npm_project_skill",
};

export function lookupForcedSkill(name: string): ForcedSkill | null {
    return (
        BUILTIN_FORCED_SKILLS.find(
            (skill) => skill.name.toLowerCase() === name.toLowerCase(),
        ) ?? null
    );
}

export function toolNameForForcedSkill(skillName: string): string | null {
    const key = skillName.trim().toLowerCase();
    if (SKILL_TOOL_BY_NAME[key]) return SKILL_TOOL_BY_NAME[key];
    // Portable / custom skills often share a catalog id with a tool, or include
    // "research" in the name — map the common research cases.
    if (/\bresearch\b/.test(key)) return "research_skill";
    if (/\bcompact/.test(key) || /\bcompress\b/.test(key)) return "compaction_skill";
    if (/\bprompt\b/.test(key) && !/\bskill\b/.test(key)) return "prompt_architect";
    if (/\bsubagents?\b/.test(key)) return "spawn_subagents";
    if (/\byoutube\b/.test(key) || /\byt\b/.test(key)) {
        return "youtube_transcript";
    }
    if (
        /\burl\s*doctor\b/.test(key) ||
        /\baudit\s*url\b/.test(key) ||
        /\burl\s*audit\b/.test(key) ||
        /\bsite\s*audit\b/.test(key)
    ) {
        return "url_doctor";
    }
    if (
        /\blinux\s*environment\b/.test(key) ||
        /\bcheerpx\b/.test(key) ||
        /\bwebvm\b/.test(key)
    ) {
        return "linux_environment_skill";
    }
    if (
        /\bnpm\b|\bnode\s+project\b|\bpackages?\b|\bdependenc(?:y|ies)\b|\blibrar(?:y|ies)\b|\bvite\b/.test(
            key,
        )
    ) {
        return "npm_project_skill";
    }
    return null;
}

/** Friendly skill label for a tool id shown in chat tool bubbles, or null. */
const TOOL_TO_SKILL_LABEL: Record<string, string> = {
    research_skill: "Research",
    compaction_skill: "Compaction",
    html_craft: "HTML Craft",
    ultimate_frontend_ui: "HTML Craft",
    frontend_design_skill: "HTML Craft",
    python_file_creation_skill: "Python File Creation",
    file_creation_skill: "Python File Creation",
    word_document_skill: "Word Document",
    word_doc_skill: "Word Document",
    create_skill: "Skill Architect",
    skill_architect: "Skill Architect",
    prompt_architect: "Prompt Architect",
    create_prompt: "Prompt Architect",
    spawn_subagent: "Subagent",
    spawn_subagents: "Subagent",
    youtube_transcript: "YouTube",
    summarize_youtube: "YouTube",
    url_doctor: "URL Doctor",
    linux_environment_skill: "Linux Environment",
    npm_project_skill: "NPM Project",
};

export function skillLabelForTool(toolName: string): string | null {
    const key = toolName.trim();
    if (TOOL_TO_SKILL_LABEL[key]) return TOOL_TO_SKILL_LABEL[key];
    if (/_skill$/i.test(key)) {
        return key
            .replace(/_skill$/i, "")
            .split(/[_\s]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
    }
    return null;
}

/** Ordered unique tool names that forced skills require on this turn. */
export function resolveRequiredSkillTools(
    skills: Array<{ name: string }> | undefined,
): string[] {
    if (!skills?.length) return [];
    const tools: string[] = [];
    const seen = new Set<string>();
    for (const skill of skills) {
        const toolName = toolNameForForcedSkill(skill.name);
        if (!toolName || seen.has(toolName)) continue;
        seen.add(toolName);
        tools.push(toolName);
    }
    return tools;
}

/**
 * Detect whether the user message needs live/web research so we can auto-force
 * the Research skill + research_skill tool.
 */
export function detectResearchIntent(text: string | undefined | null): boolean {
    const raw = (text ?? "").trim();
    if (!raw || raw.length < 8) return false;
    const t = raw.toLowerCase();

    // Explicit research / lookup asks.
    if (
        /\b(research|investigate|look\s*up|look\s+into|find\s+out|search\s+(the\s+)?(web|online|for)|web\s*search|google\s+for|cite\s+sources?|with\s+sources?|source\s+links?)\b/.test(
            t,
        )
    ) {
        return true;
    }

    // Current / live-fact asks that need retrieval.
    if (
        /\b(latest|current|today'?s|this\s+week|this\s+month|breaking|news|price\s+of|how\s+much\s+is|who\s+won|what\s+happened|release\s+notes?|changelog)\b/.test(
            t,
        )
    ) {
        return true;
    }

    // Year-stamped factual asks (e.g. "in 2026") plus evidence language.
    if (/\b20(2[4-9]|3[0-9])\b/.test(t) && /\b(news|price|release|version|update|report|stats?|data)\b/.test(t)) {
        return true;
    }

    return false;
}

export function lastUserTextFromMessages(
    messages: Array<{
        role?: string;
        parts?: Array<{ type?: string; text?: string }>;
        content?: string | Array<{ type?: string; text?: string }>;
    }> | undefined,
): string {
    if (!messages?.length) return "";
    let lastUser:
        | {
              role?: string;
              parts?: Array<{ type?: string; text?: string }>;
              content?: string | Array<{ type?: string; text?: string }>;
          }
        | undefined;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index]?.role === "user") {
            lastUser = messages[index];
            break;
        }
    }
    if (!lastUser) return "";

    if (Array.isArray(lastUser.parts)) {
        return lastUser.parts
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text!)
            .join(" ")
            .trim();
    }

    if (typeof lastUser.content === "string") return lastUser.content.trim();
    if (Array.isArray(lastUser.content)) {
        return lastUser.content
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text!)
            .join(" ")
            .trim();
    }
    return "";
}

/** Explicit re-request wording — stronger than the auto-detect heuristics. */
const EXPLICIT_RESEARCH_WORDING =
    /\b(research|investigate|look\s*up|look\s+into|find\s+out|web\s*search|google\s+for|continue\s+(the\s+)?(research|search|lookup))\b/;

export type InvokedToolNameIndex = {
    /** All names, including AIMessage toolCalls, for skill deduplication. */
    all: Set<string>;
    /** Names represented in UI message parts for MCP selection. */
    parts: Set<string>;
};

/** Collect tool names already invoked in assistant parts or AIMessage toolCalls. */
export function toolNamesInvokedInThread(
    messages: Array<{
        parts?: Array<{
            type?: string;
            toolName?: string;
            toolInvocation?: { toolName?: string };
        }>;
        toolCalls?: Array<{ name?: string }>;
    }> | undefined,
): InvokedToolNameIndex {
    const all = new Set<string>();
    const parts = new Set<string>();
    for (const message of messages ?? []) {
        if (!message || typeof message !== "object") continue;
        if (Array.isArray(message.toolCalls)) {
            for (const call of message.toolCalls) {
                if (typeof call?.name === "string" && call.name) all.add(call.name);
            }
        }
        if (Array.isArray(message.parts)) {
            for (const part of message.parts) {
                if (!part || typeof part !== "object") continue;
                const directName =
                    typeof part.toolName === "string" ? part.toolName : "";
                const invocationName =
                    typeof part.toolInvocation?.toolName === "string"
                        ? part.toolInvocation.toolName
                        : "";
                const type = typeof part.type === "string" ? part.type : "";
                const typedName = type.startsWith("tool-") ? type.slice(5) : "";
                const toolName =
                    directName ||
                    invocationName ||
                    typedName;
                if (toolName) all.add(toolName);
                const partName = directName || typedName;
                if (partName) parts.add(partName);
            }
        }
    }
    return { all, parts };
}

/** Whether any listed tool was already invoked in the thread messages. */
export function toolInvokedInThread(
    messages: Array<{
        role?: string;
        parts?: Array<{
            type?: string;
            toolName?: string;
            toolInvocation?: { toolName?: string };
        }>;
        toolCalls?: Array<{ name?: string }>;
    }> | undefined,
    toolNames: string[],
): boolean {
    if (!messages?.length || !toolNames.length) return false;
    const wanted = new Set(toolNames);
    for (const message of messages) {
        if (Array.isArray(message.toolCalls)) {
            for (const call of message.toolCalls) {
                if (call.name && wanted.has(call.name)) return true;
            }
        }
        if (Array.isArray(message.parts)) {
            for (const part of message.parts) {
                const toolName =
                    part.toolName ||
                    part.toolInvocation?.toolName ||
                    (part.type?.startsWith("tool-") ? part.type.slice(5) : undefined);
                if (toolName && wanted.has(toolName)) return true;
            }
        }
    }
    return false;
}

/**
 * Merge Research into the forced-skill list when research intent is detected.
 * `alreadyInvoked` suppresses the auto-injection once research_skill ran this
 * thread — unless the current ask explicitly re-requests research.
 */
export function ensureResearchSkill(
    skills: ForcedSkill[] | undefined,
    userText: string,
    options: {
        webSearchEnabled?: boolean;
        alreadyInvoked?: boolean;
    } = {},
): ForcedSkill[] {
    const next = [...(skills ?? [])];
    const hasResearch = next.some(
        (skill) => toolNameForForcedSkill(skill.name) === "research_skill",
    );
    if (hasResearch) return next;
    if (options.webSearchEnabled === false) return next;
    if (!detectResearchIntent(userText)) return next;
    if (
        options.alreadyInvoked === true &&
        !EXPLICIT_RESEARCH_WORDING.test(userText.toLowerCase())
    ) {
        return next;
    }
    const research = lookupForcedSkill("Research");
    if (research) next.unshift(research);
    return next;
}

/** Detect URL Doctor / site-audit asks (paste URL + health/SEO/audit language). */
export function detectUrlDoctorIntent(text: string | undefined | null): boolean {
    const raw = (text ?? "").trim();
    if (!raw || raw.length < 8) return false;
    const t = raw.toLowerCase();
    const hasUrl = /https?:\/\/[^\s]+/i.test(raw);
    if (
        /\b(url\s*doctor|audit\s*url|auditurl|url\s*audit|site\s*audit|page\s*health|website\s*health)\b/.test(
            t,
        )
    ) {
        return true;
    }
    if (
        hasUrl &&
        /\b(audit|doctor|health\s*score|seo|accessibility|a11y|performance|privacy|tracking|conversion|reputation)\b/.test(
            t,
        )
    ) {
        return true;
    }
    return false;
}

/** Merge URL Doctor when an audit intent (or /URL Doctor) is detected. */
export function ensureUrlDoctorSkill(
    skills: ForcedSkill[] | undefined,
    userText: string,
    options: { webSearchEnabled?: boolean } = {},
): ForcedSkill[] {
    const next = [...(skills ?? [])];
    const hasDoctor = next.some(
        (skill) => toolNameForForcedSkill(skill.name) === "url_doctor",
    );
    if (hasDoctor) return next;
    if (options.webSearchEnabled === false) return next;
    if (!detectUrlDoctorIntent(userText)) return next;
    const doctor = lookupForcedSkill("URL Doctor");
    if (doctor) next.unshift(doctor);
    return next;
}

/**
 * Detect UI / frontend build or redesign asks so we can auto-force a design skill.
 * Soft prompt-only guidance is easy for models to skip; hard-forcing the tool
 * makes them actually load the contract before writing HTML/CSS/React.
 */
export function detectFrontendIntent(text: string | undefined | null): boolean {
    const raw = (text ?? "").trim();
    if (!raw || raw.length < 8) return false;
    const t = raw.toLowerCase();

    // Explicit skill / design brief asks.
    if (
        /\b(frontend design|ui design|design brief|design system|visual hierarchy|accessibility)\b/.test(
            t,
        )
    ) {
        return true;
    }

    // Build / redesign a frontend surface.
    if (
        /\b(build|create|make|generate|design|redesign|restyle|polish)\b/.test(t) &&
        /\b(website|web\s*site|landing\s*page|web\s*page|webpage|dashboard|ui|ux|frontend|front-end|interface|html\s*page|react\s*(app|component|page)|next\.?js|tailwind)\b/.test(
            t,
        )
    ) {
        return true;
    }

    // Shorthand site asks without an explicit verb.
    if (
        /\b(landing\s*page|marketing\s*site|portfolio\s*site|saas\s*(landing|site)|admin\s*dashboard)\b/.test(
            t,
        )
    ) {
        return true;
    }

    return false;
}

/** Prefer Ultimate Frontend UI for builds; Frontend Design for brief-only asks. */
export function ensureFrontendSkill(
    skills: ForcedSkill[] | undefined,
    userText: string,
): ForcedSkill[] {
    const next = [...(skills ?? [])];
    const hasFrontend = next.some((skill) => {
        const tool = toolNameForForcedSkill(skill.name);
        return tool === "ultimate_frontend_ui" || tool === "frontend_design_skill";
    });
    if (hasFrontend) return next;
    if (!detectFrontendIntent(userText)) return next;

    const t = userText.toLowerCase();
    const briefOnly =
        /\b(design brief|design guidance|design recommendations?|wireframe|component structure)\b/.test(
            t,
        ) && !/\b(build|create|make|generate|implement|code|html|css|react)\b/.test(t);

    const skill = lookupForcedSkill(
        briefOnly ? "Frontend Design" : "Ultimate Frontend UI",
    );
    if (skill) next.unshift(skill);
    return next;
}

export function detectCompactionIntent(text: string | undefined | null): boolean {
    const raw = (text ?? "").trim();
    if (!raw || raw.length < 6) return false;
    const t = raw.toLowerCase();
    return (
        /\b\/?\s*compaction\b/.test(t) ||
        /\b(compact|compress|shrink|reclaim)\b.{0,24}\b(context|history|thread|conversation|chat)\b/.test(
            t,
        ) ||
        /\b(context|history|thread|conversation)\b.{0,24}\b(compact|compress|too long|context limit)\b/.test(
            t,
        )
    );
}

export function ensureCompactionSkill(
    skills: ForcedSkill[] | undefined,
    userText: string,
): ForcedSkill[] {
    const next = [...(skills ?? [])];
    const hasCompaction = next.some(
        (skill) => toolNameForForcedSkill(skill.name) === "compaction_skill",
    );
    if (hasCompaction) return next;
    if (!detectCompactionIntent(userText)) return next;
    const skill = lookupForcedSkill("Compaction");
    if (skill) next.unshift(skill);
    return next;
}

/** Detect in-browser Linux / CheerpX / compile-in-VM asks. */
export function detectLinuxIntent(text: string | undefined | null): boolean {
    const raw = (text ?? "").trim();
    if (!raw || raw.length < 6) return false;
    const t = raw.toLowerCase();
    if (
        /\b(linux\s*environment|cheerpx|webvm|in-?browser\s+linux|browser\s+linux|linux\s+vm|debian\s+vm|linux\s+sandbox)\b/.test(
            t,
        )
    ) {
        return true;
    }
    if (/\b(linux_run_command|linux_read_file|run_command)\b/.test(t)) {
        return true;
    }
    if (
        /\b(use|using|in|with)\b.{0,24}\b(linux|bash|the\s+vm|your\s+linux)\b/.test(t)
    ) {
        return true;
    }
    if (/\b(gcc|g\+\+|compile)\b/.test(t) && /\b(\.c\b|hello\.c|c\s+file)\b/.test(t)) {
        return true;
    }
    if (detectNpmProjectIntent(raw)) return true;
    return false;
}

/** Detect requests that need a browser-local Node/npm project workspace. */
export function detectNpmProjectIntent(text: string | undefined | null): boolean {
    const raw = (text ?? "").trim();
    if (!raw || raw.length < 6) return false;
    const t = raw.toLowerCase();
    const hasNpmConcept =
        /\bnpm\b|\bnode(?:\.js)?\b|\bpackages?\b|\bdependenc(?:y|ies)\b|\blibrar(?:y|ies)\b|\bvite\b|\breact\s+app\b/.test(
            t,
        );
    if (!hasNpmConcept) return false;
    return /\b(create|build|make|generate|scaffold|implement|install|add|use|run|bundle|compile|project|app|site|website)\b/.test(
        t,
    );
}

/**
 * Merge Linux Environment when the user asks for the in-browser VM.
 * `alreadyInvoked` skips re-injection once the contract was loaded this thread —
 * later turns reuse the loaded contract per the skill's once-per-conversation
 * rule.
 */
export function ensureLinuxSkill(
    skills: ForcedSkill[] | undefined,
    userText: string,
    options: { linuxEnvironment?: boolean; alreadyInvoked?: boolean } = {},
): ForcedSkill[] {
    const next = [...(skills ?? [])];
    const hasLinux = next.some(
        (skill) => toolNameForForcedSkill(skill.name) === "linux_environment_skill",
    );
    if (hasLinux) return next;
    if (options.linuxEnvironment === false) return next;
    if (!detectLinuxIntent(userText)) return next;
    if (options.alreadyInvoked === true) return next;
    const skill = lookupForcedSkill("Linux Environment");
    if (skill) next.unshift(skill);
    return next;
}

/** Force the curated npm project contract before Node/library work. */
export function ensureNpmProjectSkill(
    skills: ForcedSkill[] | undefined,
    userText: string,
    options: {
        linuxEnvironment?: boolean;
        npmProjectEnabled?: boolean;
        alreadyInvoked?: boolean;
    } = {},
): ForcedSkill[] {
    const next = [...(skills ?? [])];
    const hasNpm = next.some(
        (skill) => toolNameForForcedSkill(skill.name) === "npm_project_skill",
    );
    if (
        hasNpm ||
        options.linuxEnvironment === false ||
        options.npmProjectEnabled === false ||
        options.alreadyInvoked === true
    ) {
        return next;
    }
    if (!detectNpmProjectIntent(userText)) return next;
    const skill = lookupForcedSkill("NPM Project");
    if (skill) next.unshift(skill);
    return next;
}
