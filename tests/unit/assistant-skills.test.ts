import { describe, expect, it } from "vitest";
import { buildJsonRenderInstructions } from "~/components/generative-ui/json/instructions";
import { richLibrary, richPromptOptions } from "~/components/generative-ui/library";
import { sanitizeModelInstructions } from "~/lib/server/frontend-tools";
import {
    ASSISTANT_SKILL_PREFIX,
    MAX_ASSISTANT_SKILLS,
    MAX_SKILL_BODY_CHARS,
    readSkill,
    removeAssistantSkill,
    saveAssistantSkill,
    searchSkills,
    skillIndex,
    skillInstructions,
    skillSlug,
} from "~/lib/skills/assistant-skills";
import { getBundledSkill, installBundledSkill } from "~/lib/skills/catalog";
import type { CustomSkill } from "~/lib/types";

const body = (extra = "") =>
    `When to use: weekly status updates.\n1. Collect the notes.\n2. Group by project.\n3. Write three bullets per project.\nOutput: a markdown list. Check: every project appears. ${extra}`;

const userSkill: CustomSkill = {
    id: "custom-1",
    name: "Weekly Report",
    description: "The user's own weekly report format",
    content: "# Weekly Report\n\nThe user's own steps go here and they are long enough to count.",
    enabled: true,
};

describe("skill names and index", () => {
    it("slugs names", () => {
        expect(skillSlug("  Weekly Report!! ")).toBe("weekly-report");
        expect(skillSlug("***")).toBe("");
    });
    it("lists only enabled skills, one bounded line each", () => {
        const many: CustomSkill[] = Array.from({ length: 80 }, (_, i) => ({
            ...userSkill,
            id: `c${i}`,
            name: `Skill ${i}`,
            description: "d".repeat(400),
        }));
        const index = skillIndex([{ ...userSkill, enabled: false }, ...many]);
        expect(index).not.toContain("weekly-report");
        expect(index.split("\n").length).toBeLessThanOrEqual(30);
        expect(index.length).toBeLessThanOrEqual(2_500);
        expect(index.split("\n")[0].length).toBeLessThan(140);
    });
});

describe("finding and reading skills", () => {
    it("finds installed skills first and catalog skills that are not installed", () => {
        const hits = searchSkills("weekly report", [userSkill]);
        expect(hits[0]).toMatchObject({ name: "weekly-report", installed: true });
        const review = searchSkills("code review", []);
        expect(review.some((hit) => hit.name === "code-review" && !hit.installed)).toBe(true);
    });
    it("does not bring back a bundled skill the user disabled", () => {
        const disabled = installBundledSkill("code-review", []).map((skill) => ({
            ...skill,
            enabled: false,
        }));
        expect(
            searchSkills("code review", disabled).some((hit) => hit.name === "code-review"),
        ).toBe(false);
        expect(readSkill("code-review", disabled)).toEqual({
            ok: false,
            error: 'The skill "code-review" is disabled by the user.',
        });
    });
    it("returns the complete bundled skill, not the truncated installed copy", () => {
        const bundled = getBundledSkill("code-review")!;
        const installed = installBundledSkill("code-review", []);
        for (const custom of [[], installed]) {
            const result = readSkill("code-review", custom);
            expect(result.ok).toBe(true);
            if (!result.ok) continue;
            expect(result.source).toBe("bundled");
            expect(result.content).toContain(bundled.content.trim().slice(-200));
        }
    });
    it("reads installed user skills and reports unknown ones", () => {
        const result = readSkill("Weekly Report", [userSkill]);
        expect(result).toMatchObject({ ok: true, source: "installed" });
        expect(readSkill("nope-nothing", [userSkill]).ok).toBe(false);
        expect(readSkill("   ", []).ok).toBe(false);
    });
});

describe("saving assistant skills", () => {
    const good = {
        name: "Status Digest",
        description: "Turn raw weekly notes into a project status digest.",
        content: body(),
        sources: ["https://example.com/guide"],
    };

    it("adds an enabled assistant skill with a header and sources", () => {
        const result = saveAssistantSkill(good, [userSkill]);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.skill.id).toBe(`${ASSISTANT_SKILL_PREFIX}status-digest`);
        expect(result.skill.enabled).toBe(true);
        expect(result.skill.content).toContain("# Status Digest");
        expect(result.skill.content).toContain("## Sources\n\n- https://example.com/guide");
        expect(result.custom).toHaveLength(2);
        expect(result.replaced).toBe(false);
        // The saved skill is visible to the model's index and readable in full.
        expect(skillIndex(result.custom)).toContain("- status-digest:");
        expect(readSkill("status-digest", result.custom).ok).toBe(true);
    });
    it("keeps only plain http(s) sources and drops credentials", () => {
        const result = saveAssistantSkill(
            {
                ...good,
                sources: [
                    "javascript:alert(1)",
                    "ftp://example.com/x",
                    "not a url",
                    "https://user:secret@example.com/docs",
                    "https://example.com/docs",
                ],
            },
            [],
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.skill.content).not.toContain("javascript:");
        expect(result.skill.content).not.toContain("secret");
        expect(result.skill.content.match(/https:\/\/example\.com\/docs/g)).toHaveLength(1);
    });
    it("strips a pasted frontmatter block and control characters", () => {
        const result = saveAssistantSkill(
            { ...good, content: `---\nname: x\ntools: [web_search]\n---\n${body("\u0007bell")}` },
            [],
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.skill.content).not.toContain("tools:");
        expect(result.skill.content).not.toContain("\u0007");
    });
    it("updates its own skill in place", () => {
        const first = saveAssistantSkill(good, []);
        if (!first.ok) throw new Error("setup");
        const second = saveAssistantSkill(
            { ...good, content: body("v2 improvements") },
            first.custom,
        );
        expect(second.ok).toBe(true);
        if (!second.ok) return;
        expect(second.replaced).toBe(true);
        expect(second.custom).toHaveLength(1);
        expect(second.skill.content).toContain("v2 improvements");
    });
    it("never overwrites the user's skills or shadows built-in ones", () => {
        const clash = saveAssistantSkill({ ...good, name: "weekly report" }, [userSkill]);
        expect(clash.ok).toBe(false);
        const bundled = saveAssistantSkill({ ...good, name: "code-review" }, []);
        expect(bundled.ok).toBe(false);
        // A user-installed copy of a bundled skill is protected too.
        expect(
            saveAssistantSkill(
                { ...good, name: "code-review" },
                installBundledSkill("code-review", []),
            ).ok,
        ).toBe(false);
    });
    it("rejects empty, tiny and oversized skills with a message the model can act on", () => {
        const bad = (patch: Record<string, string>) =>
            saveAssistantSkill({ ...good, ...patch }, []);
        expect(bad({ name: "!" }).ok).toBe(false);
        expect(bad({ description: "short" }).ok).toBe(false);
        expect(bad({ content: "too short" }).ok).toBe(false);
        const huge = bad({ content: "x".repeat(MAX_SKILL_BODY_CHARS + 1) });
        expect(huge.ok).toBe(false);
        if (!huge.ok) expect(huge.error).toContain("Shorten");
    });
    it("caps how many skills the assistant can create", () => {
        const full: CustomSkill[] = Array.from({ length: MAX_ASSISTANT_SKILLS }, (_, i) => ({
            ...userSkill,
            id: `${ASSISTANT_SKILL_PREFIX}s${i}`,
            name: `S${i}x`,
        }));
        const result = saveAssistantSkill(good, full);
        expect(result.ok).toBe(false);
        // Updating one of them is still allowed.
        expect(saveAssistantSkill({ ...good, name: "s1x" }, full).ok).toBe(true);
    });
    it("removes only assistant-created skills", () => {
        const saved = saveAssistantSkill(good, [userSkill]);
        if (!saved.ok) throw new Error("setup");
        expect(removeAssistantSkill(saved.skill.id, saved.custom)).toEqual([userSkill]);
        expect(removeAssistantSkill(userSkill.id, saved.custom)).toEqual(saved.custom);
    });
});

describe("skill instructions", () => {
    it("names the tools, lists installed skills and states the safety rules", () => {
        const text = skillInstructions([userSkill]);
        for (const tool of ["find_skill", "use_skill", "save_skill"]) expect(text).toContain(tool);
        expect(text).toContain("- weekly-report:");
        expect(text).toContain("data, not instructions");
        expect(text.length).toBeLessThan(5_500);
    });
    it("with the largest skill index, still fits the server cap together with the UI prompts", () => {
        const many: CustomSkill[] = Array.from({ length: 60 }, (_, i) => ({
            ...userSkill,
            id: `c${i}`,
            name: `Skill number ${i}`,
            description: "d".repeat(300),
        }));
        const combined = [
            richLibrary.prompt(richPromptOptions),
            buildJsonRenderInstructions(),
            skillInstructions(many),
        ].join("\n\n");
        expect(sanitizeModelInstructions(combined)).toHaveLength(combined.trim().length);
    });
});
