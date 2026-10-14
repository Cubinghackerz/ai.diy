import { describe, expect, it } from "vitest";
import { buildChatSystemPromptParts } from "~/lib/server/prompt";
import {
    lookupForcedSkill,
    resolveRequiredSkillTools,
    toolNameForForcedSkill,
} from "~/lib/skill-command";
import {
    attachRoutedSkills,
    catalogRouterDocs,
    routeSkills,
    selectRoutedSkills,
} from "~/lib/skills/router";
import { tokenModePolicy } from "~/lib/token-mode";
import { scoreRetriever } from "./harness";

describe("lexical BM25 router", () => {
    it("meets the warm top-3 / false-load / p95 gate", () => {
        const docs = catalogRouterDocs();
        for (const warm of ["warmup code review", "sql join", "summarize this article"]) {
            routeSkills(warm, docs);
        }
        const score = scoreRetriever((q) => routeSkills(q, docs).skills.map((hit) => hit.slug));
        // eslint-disable-next-line no-console
        console.log("LEXICAL_ROUTER", JSON.stringify(score, null, 2));
        expect(score.positives).toBe(100);
        expect(score.negatives).toBe(20);
        expect(score.top3).toBeGreaterThanOrEqual(0.8);
        expect(score.falseLoads).toBeLessThanOrEqual(1);
        expect(score.p95Ms).toBeLessThan(5);
    });

    it("keeps /Research forced as research_skill when a routed skill is merged", () => {
        const research = lookupForcedSkill("Research");
        expect(research).toBeTruthy();
        expect(toolNameForForcedSkill(research!.name)).toBe("research_skill");
        expect(resolveRequiredSkillTools([research!])).toEqual(["research_skill"]);
        const routed = selectRoutedSkills(
            [research!],
            [{ name: "code-review", content: "Review the diff. Call out tests." }],
            tokenModePolicy("balanced"),
        );
        expect(resolveRequiredSkillTools([research!])).toEqual(["research_skill"]);
        expect(routed.map((skill) => skill.name)).toEqual(["code-review"]);
        expect(resolveRequiredSkillTools([...[research!], ...routed])[0]).toBe("research_skill");
    });

    it("does not drop a slash-forced skill when token-mode caps routed slots", () => {
        const research = lookupForcedSkill("Research")!;
        const selected = selectRoutedSkills(
            [research],
            [
                { name: "code-review", content: "a" },
                { name: "sql-analyst", content: "b" },
                { name: "summarizer", content: "c" },
            ],
            tokenModePolicy("efficient"),
        );
        expect(research.name).toBe("Research");
        expect(selected).toHaveLength(1);
        expect(selected[0].name).toBe("code-review");
    });

    it("leaves the stable prompt prefix unchanged when a routed skill is added", () => {
        const research = lookupForcedSkill("Research")!;
        const base = buildChatSystemPromptParts(
            undefined,
            "",
            [research],
            "main",
            "",
            false,
            "caching",
            ["research_skill", "web_search"],
        );
        const next = attachRoutedSkills(
            base,
            [{ name: "code-review", content: "Structured review steps for this turn." }],
            tokenModePolicy("caching").skillChars,
        );
        expect(next.stable).toBe(base.stable);
        expect(next.volatile).toContain("UNTRUSTED-ROUTED-SKILLS");
        expect(next.volatile).toContain("code-review");
        expect(next.full.startsWith(next.stable)).toBe(true);
    });
});
