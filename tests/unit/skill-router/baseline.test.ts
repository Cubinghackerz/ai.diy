import { describe, expect, it } from "vitest";
import { searchSkills } from "~/lib/skills/assistant-skills";
import { searchBundledSkills } from "~/lib/skills/catalog";
import { scoreRetriever, loadQueries } from "./harness";

describe("skill-router baseline (current find_skill)", () => {
    it("scores searchSkills over the catalog (no installed skills)", () => {
        const score = scoreRetriever((q) => searchSkills(q, []).map((r) => r.name));
        // eslint-disable-next-line no-console
        console.log("BASELINE_FIND_SKILL", JSON.stringify(score, null, 2));
        expect(score.positives).toBe(100);
        expect(score.negatives).toBe(20);
        expect(true).toBe(true);
    });

    it("also scores the raw catalog substring retriever for reference", () => {
        const score = scoreRetriever((q) => searchBundledSkills(q).map((s) => s.name));
        // eslint-disable-next-line no-console
        console.log("BASELINE_CATALOG_SUBSTRING", JSON.stringify(score, null, 2));
        expect(score.positives).toBe(100);
    });
});
