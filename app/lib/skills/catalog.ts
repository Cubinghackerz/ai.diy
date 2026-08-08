/**
 * Bundled skill catalog — imported at build time from skills/catalog.json.
 * Full SKILL.md bodies are loaded via Vite glob for install.
 */

import type { CustomSkill } from "~/lib/types";
import {
    parseSkillMarkdown,
    skillToForcedContent,
    type PortableSkill,
    type SkillCatalog,
    type SkillCatalogEntry,
} from "~/lib/skills/format";
import catalogJson from "../../../skills/catalog.json";

const skillModules = import.meta.glob("../../../skills/**/SKILL.md", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

export const SKILL_CATALOG: SkillCatalog = catalogJson as SkillCatalog;

function normalizeGlobPath(key: string): string {
    // keys look like ../../../skills/developer/code-review/SKILL.md
    const idx = key.indexOf("skills/");
    return idx >= 0 ? key.slice(idx + "skills/".length) : key;
}

let cachedSkills: PortableSkill[] | null = null;

export function listBundledSkills(): PortableSkill[] {
    if (cachedSkills) return cachedSkills;
    const skills: PortableSkill[] = [];
    for (const [key, raw] of Object.entries(skillModules)) {
        const path = normalizeGlobPath(key);
        const parsed = parseSkillMarkdown(raw, path);
        if (parsed) skills.push(parsed);
    }
    skills.sort((a, b) => a.name.localeCompare(b.name));
    cachedSkills = skills;
    return skills;
}

export function getBundledSkill(id: string): PortableSkill | null {
    return (
        listBundledSkills().find(
            (skill) => skill.name.toLowerCase() === id.toLowerCase(),
        ) ?? null
    );
}

export function searchBundledSkills(query: string): PortableSkill[] {
    const q = query.trim().toLowerCase();
    const all = listBundledSkills();
    if (!q) {
        return [...all].sort(
            (a, b) => Number(b.popular) - Number(a.popular) || a.title.localeCompare(b.title),
        );
    }
    return all.filter(
        (skill) =>
            skill.name.includes(q) ||
            skill.title.toLowerCase().includes(q) ||
            skill.description.toLowerCase().includes(q) ||
            skill.category.includes(q),
    );
}

export function isSkillInstalled(
    skillId: string,
    customSkills: CustomSkill[],
): boolean {
    return customSkills.some(
        (skill) =>
            skill.id === `bundled_${skillId}` ||
            skill.name.toLowerCase() === skillId.toLowerCase() ||
            skill.name.toLowerCase() ===
                skillId.replace(/-/g, " ").toLowerCase(),
    );
}

export function installBundledSkill(
    skillId: string,
    customSkills: CustomSkill[],
): CustomSkill[] {
    const bundled = getBundledSkill(skillId);
    if (!bundled) return customSkills;
    if (isSkillInstalled(skillId, customSkills)) return customSkills;
    const next: CustomSkill = {
        id: `bundled_${bundled.name}`,
        name: bundled.title,
        description: bundled.description,
        content: skillToForcedContent(bundled),
        enabled: true,
    };
    return [...customSkills, next];
}

export function uninstallBundledSkill(
    skillId: string,
    customSkills: CustomSkill[],
): CustomSkill[] {
    const bundled = getBundledSkill(skillId);
    const titles = new Set(
        [skillId, bundled?.name, bundled?.title]
            .filter(Boolean)
            .map((s) => String(s).toLowerCase()),
    );
    return customSkills.filter((skill) => {
        if (skill.id === `bundled_${skillId}`) return false;
        if (titles.has(skill.name.toLowerCase())) return false;
        return true;
    });
}

export function popularCatalogEntries(): SkillCatalogEntry[] {
    return SKILL_CATALOG.skills.filter((s) => s.popular);
}
