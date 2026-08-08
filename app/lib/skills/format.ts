/**
 * Portable skill format — parse SKILL.md frontmatter + body.
 * UI-agnostic; suitable for install into customSkills or agent prompts.
 */

export type SkillCategory =
    | "developer"
    | "research"
    | "data"
    | "security"
    | "devops"
    | "business"
    | "general";

export type SkillToolId =
    | "web_search"
    | "fetch_url"
    | "run_python"
    | "calculator"
    | "generate_file"
    | "create_file"
    | "memory"
    | "ask_user";

export type SkillPermission = "network" | "filesystem" | "code_execution";

export interface SkillManifest {
    name: string;
    version: string;
    description: string;
    category: SkillCategory;
    tools: SkillToolId[];
    permissions: SkillPermission[];
    popular: boolean;
    inputs: { name: string; type: string; required?: boolean }[];
    outputs: { name: string; type: string }[];
}

export interface PortableSkill extends SkillManifest {
    /** Full markdown body after frontmatter (instructions). */
    content: string;
    /** Absolute-ish path relative to skills/ catalog root. */
    path: string;
    /** Display title derived from name. */
    title: string;
}

export interface SkillCatalogEntry {
    id: string;
    name: string;
    version: string;
    description: string;
    category: SkillCategory;
    path: string;
    popular?: boolean;
    tools?: string[];
}

export interface SkillCatalog {
    version: number;
    skills: SkillCatalogEntry[];
}

function titleFromId(id: string): string {
    return id
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function parseScalar(raw: string): string | boolean | number {
    const v = raw.trim();
    if (v === "true") return true;
    if (v === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
    ) {
        return v.slice(1, -1);
    }
    return v;
}

/** Minimal YAML-ish frontmatter parser for skill manifests (no nested objects beyond lists). */
export function parseSkillMarkdown(
    raw: string,
    path = "",
): PortableSkill | null {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return null;
    const [, fm, body] = match;
    const lines = fm.split(/\r?\n/);
    const data: Record<string, unknown> = {};
    let listKey: string | null = null;
    let listItems: unknown[] = [];
    let objectAccum: Record<string, unknown> | null = null;

    const flushList = () => {
        if (listKey) {
            data[listKey] = listItems;
            listKey = null;
            listItems = [];
            objectAccum = null;
        }
    };

    for (const line of lines) {
        if (!line.trim() || line.trim().startsWith("#")) continue;
        const listItem = line.match(/^\s*-\s+(.*)$/);
        if (listItem && listKey) {
            const itemRaw = listItem[1];
            if (/^\w+:/.test(itemRaw) || itemRaw.includes(": ")) {
                // object list item start: name: value pairs on following indented lines handled simply
                const obj: Record<string, unknown> = {};
                const first = itemRaw.match(/^(\w+)\s*:\s*(.*)$/);
                if (first) {
                    obj[first[1]] = parseScalar(first[2] || "true");
                }
                objectAccum = obj;
                listItems.push(obj);
            } else {
                objectAccum = null;
                listItems.push(parseScalar(itemRaw));
            }
            continue;
        }
        const nested = line.match(/^\s{2,}(\w+)\s*:\s*(.*)$/);
        if (nested && objectAccum) {
            objectAccum[nested[1]] = parseScalar(nested[2]);
            continue;
        }
        const kv = line.match(/^(\w+)\s*:\s*(.*)$/);
        if (kv) {
            flushList();
            const key = kv[1];
            const val = kv[2];
            if (val === "" || val === "|" || val === ">") {
                listKey = key;
                listItems = [];
                objectAccum = null;
            } else if (val.startsWith("[") && val.endsWith("]")) {
                const inner = val.slice(1, -1).trim();
                data[key] = inner
                    ? inner.split(",").map((s) => parseScalar(s.trim()))
                    : [];
            } else {
                data[key] = parseScalar(val);
            }
        }
    }
    flushList();

    const name = String(data.name ?? "").trim();
    if (!name) return null;

    const tools = Array.isArray(data.tools)
        ? (data.tools as unknown[]).map(String)
        : [];
    const permissions = Array.isArray(data.permissions)
        ? (data.permissions as unknown[]).map(String)
        : [];
    const inputs = Array.isArray(data.inputs)
        ? (data.inputs as Record<string, unknown>[]).map((item) => ({
              name: String(item.name ?? "task"),
              type: String(item.type ?? "string"),
              required: item.required !== false && item.required !== "false",
          }))
        : [{ name: "task", type: "string", required: true }];
    const outputs = Array.isArray(data.outputs)
        ? (data.outputs as Record<string, unknown>[]).map((item) => ({
              name: String(item.name ?? "result"),
              type: String(item.type ?? "markdown"),
          }))
        : [{ name: "result", type: "markdown" }];

    return {
        name,
        version: String(data.version ?? "1.0.0"),
        description: String(data.description ?? ""),
        category: (String(data.category ?? "general") as SkillCategory),
        tools: tools as SkillToolId[],
        permissions: permissions as SkillPermission[],
        popular: data.popular === true,
        inputs,
        outputs,
        content: body.trim(),
        path,
        title: titleFromId(name),
    };
}

/** Build installable custom-skill content: full instructions with charter header. */
export function skillToForcedContent(skill: PortableSkill): string {
    return `# ${skill.title}\n\n${skill.description}\n\n${skill.content}`.slice(
        0,
        16_000,
    );
}

export function catalogEntryFromSkill(
    skill: PortableSkill,
): SkillCatalogEntry {
    return {
        id: skill.name,
        name: skill.title,
        version: skill.version,
        description: skill.description,
        category: skill.category,
        path: skill.path || `${skill.category}/${skill.name}/SKILL.md`,
        popular: skill.popular,
        tools: skill.tools,
    };
}
