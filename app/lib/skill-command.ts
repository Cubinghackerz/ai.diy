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

export const forcedSkillStore: { current: ForcedSkill[] } = {
    current: [],
};

/** Built-in skills that can be force-selected without custom content. */
export const BUILTIN_FORCED_SKILLS: ForcedSkill[] = [
    {
        name: "Research",
        content:
            "You MUST handle this request with the research_skill: call the research_skill tool first, then run only the necessary searches and page reads it prescribes. Do not rely on training data or knowledge-cutoff memory for time-sensitive facts, new releases, versions, pricing, or changelogs; every material claim must come from sources retrieved in this session. Cite every source URL you used and report confidence per claim. Do not answer before calling research_skill.",
    },
    {
        name: "Compaction",
        content:
            "You MUST activate and follow the compaction_skill for this request: call the compaction_skill tool first to compress prior conversation into a faithful carry-forward brief (goals, decisions, constraints, open threads, cited URLs). Do not invent details that are not in the source turns. After compaction, continue from the brief plus the recent messages, and keep using the active tools available this turn. Do not answer before calling compaction_skill.",
    },
    {
        name: "Ultimate Frontend UI",
        content:
            "You MUST activate and follow the ultimate_frontend_ui skill for this request before writing any code: call the ultimate_frontend_ui tool, then comply with its design thesis, interface-mode classification, state map, responsive/accessibility/performance/security gates, and validation contract. Do not answer before calling ultimate_frontend_ui.",
    },
    {
        name: "Frontend Design",
        content:
            "You MUST activate and follow the frontend_design_skill for this request: call the frontend_design_skill tool and produce the implementation-ready design brief it defines (hierarchy, responsive behavior, states, accessibility, reusable components) before answering. Do not answer before calling frontend_design_skill.",
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
];

/** Search aliases for the slash skill menu (name + shortcuts). */
const SKILL_MENU_ALIASES: Record<string, string[]> = {
    research: ["research", "web research", "search"],
    compaction: ["compaction", "compact", "compress", "context", "shrink"],
    "ultimate frontend ui": ["ultimate frontend ui", "frontend ui", "ui"],
    "frontend design": ["frontend design", "design"],
    "python file creation": ["python file creation", "python", "file"],
    "word document": ["word document", "word", "docx"],
    "skill architect": ["skill architect", "skill", "architect"],
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
    "ultimate frontend ui": "ultimate_frontend_ui",
    "frontend design": "frontend_design_skill",
    "python file creation": "python_file_creation_skill",
    "word document": "word_document_skill",
    "skill architect": "create_skill",
    compaction: "compaction_skill",
    "context compaction": "compaction_skill",
    compress: "compaction_skill",
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
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
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

/** Merge Research into the forced-skill list when research intent is detected. */
export function ensureResearchSkill(
    skills: ForcedSkill[] | undefined,
    userText: string,
    options: { webSearchEnabled?: boolean } = {},
): ForcedSkill[] {
    const next = [...(skills ?? [])];
    const hasResearch = next.some(
        (skill) => toolNameForForcedSkill(skill.name) === "research_skill",
    );
    if (hasResearch) return next;
    if (options.webSearchEnabled === false) return next;
    if (!detectResearchIntent(userText)) return next;
    const research = lookupForcedSkill("Research");
    if (research) next.unshift(research);
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
