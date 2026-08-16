/**
 * Research skill variants, selected by the user's token mode.
 *
 * - `efficient`  → Token Efficient (minimal retrieval + minimal output)
 * - `balanced`   → Balanced (reliable, current, well-sourced, no waste)
 * - `full`       → Maximum Reliability (aggressive verification, no budget)
 * - `caching`    → Balanced (cache reuse is orthogonal to research rigor)
 */

export type ResearchSkillVariant = "maximum" | "balanced" | "efficient";

export type ResearchDepth = "quick" | "standard" | "deep";

export function researchVariantForTokenMode(
    tokenMode: string | undefined,
): ResearchSkillVariant {
    switch (tokenMode) {
        case "efficient":
            return "efficient";
        case "full":
            return "maximum";
        default:
            return "balanced";
    }
}

export function defaultDepthForVariant(
    variant: ResearchSkillVariant,
): ResearchDepth {
    switch (variant) {
        case "efficient":
            return "quick";
        case "maximum":
            return "deep";
        default:
            return "standard";
    }
}

const MAXIMUM_GUIDE = `# Research Skill — Maximum Reliability

## Mission

Produce the strongest defensible answer available from live research. Optimize for **accuracy, source quality, completeness, epistemic precision, contradiction resolution, and candidate comparison** rather than token cost or retrieval count.

Use as many searches, source fetches, verification passes, and research angles as materially improve the answer.

Do not stop merely because a plausible answer has been found. Stop when further research has low expected value.

---

# 1. Evidence Standard

All time-sensitive or externally verifiable factual claims must be supported by evidence retrieved during the current session.

Training knowledge is permitted only for:

* generating hypotheses;
* identifying likely terminology;
* proposing source locations;
* noticing possible inconsistencies.

It is never evidence.

When retrieval contradicts memory, retrieval wins.

When evidence is insufficient, explicitly preserve uncertainty.

Never fill an evidentiary gap from memory.

---

# 2. Preserve User Scope

Keep the research question close to the user's actual request.

Do not silently add:

* vendors;
* geographies;
* years;
* model categories;
* evaluation criteria;
* political assumptions;
* definitions of importance.

When interpretation is unavoidable, make the criterion explicit.

---

# 3. Establish Time Precisely

For any request involving:

* latest;
* current;
* today;
* this week;
* recently;
* last N days/weeks/months;

determine the exact current date and relevant timezone first.

Convert the user's period into explicit dates.

Then determine eligibility based on the **underlying event date**, not merely the article's publication date.

Maintain distinct date fields when relevant:

* event date;
* announcement date;
* publication date;
* release date;
* rollout date;
* effective date;
* operative date;
* research-completion date;
* filing date;
* decision date.

Never collapse these labels for convenience.

If the exact event date is unknowable, say so.

---

# 4. Source Hierarchy

Seek the strongest possible evidence for each claim.

Preferred hierarchy:

1. statutes, regulations, court documents, government records;
2. official company announcements and technical documentation;
3. original research papers and accompanying artifacts;
4. source code repositories, model cards, filings, datasets, benchmark outputs;
5. first-party speeches, transcripts, investor materials;
6. high-quality independent reporting;
7. expert analysis;
8. specialist publications;
9. secondary summaries;
10. aggregators only as discovery tools.

Prefer sources closest to the underlying event.

For disputed claims, seek evidence from multiple independent source classes.

---

# 5. Search Strategy

Use short, high-signal searches first, then expand systematically.

Possible search angles include:

* exact event/model name;
* official domain;
* competing terminology;
* primary document title;
* independent reporting;
* skeptical or critical coverage;
* benchmark reproduction;
* legal or regulatory interpretation;
* date-specific search;
* source disagreement;
* expert commentary;
* archived or versioned documentation when timing matters.

Do not search broadly without purpose.

Each additional search should answer a specific unresolved question.

---

# 6. Candidate Discovery for Ranked Tasks

For requests such as:

* most important;
* top developments;
* biggest stories;
* leading models;
* best options;

do not select the first qualifying items found.

Build a broad candidate pool first.

For each candidate record:

* event date;
* source quality;
* novelty;
* affected population;
* technical significance;
* commercial significance;
* scientific significance;
* regulatory/legal significance;
* safety/security significance;
* durability;
* evidence confidence.

Then eliminate:

* duplicate stories;
* syndicated versions of one report;
* stories outside the time window;
* weakly supported claims;
* routine releases with little broader consequence;
* candidates materially dominated by stronger developments.

Only then rank finalists.

---

# 7. Independence Analysis

Do not equate multiple articles with multiple independent confirmations.

Trace the provenance of claims.

If five outlets all cite the same:

* press release;
* Reuters story;
* company benchmark;
* government statement;
* unnamed-source leak;

they may represent only one underlying evidentiary origin.

Classify each source as:

**Primary evidence**
Direct evidence of the underlying event.

**Independent confirmation**
Evidence produced independently of the interested party.

**Independent reporting of a claim**
Confirms that a claim was made, but not its truth.

**Syndicated/repeated evidence**
Adds little or no evidentiary independence.

**Analysis/commentary**
Provides interpretation but not primary factual verification.

State this distinction when consequential.

---

# 8. Vendor and Interested-Party Claims

For claims originating from:

* companies;
* governments;
* political actors;
* vendors;
* investors;
* advocacy organizations;
* parties to litigation;

separate the existence of the statement from the truth of the underlying claim.

Example:

Verified:

> OpenAI says the system reaches 750 tokens/sec.

Not independently verified:

> The system reaches 750 tokens/sec under representative production conditions.

Never convert attribution into verification.

---

# 9. Numerical Claim Audit

For every consequential metric, determine where possible:

1. exact value;
2. unit;
3. denominator;
4. measurement period;
5. comparison baseline;
6. methodology;
7. who measured it;
8. whether the methodology changed;
9. whether independent reproduction exists;
10. whether comparison metrics are actually commensurable.

Apply this to:

* benchmark scores;
* MAUs/DAUs;
* tokens/sec;
* latency;
* revenue;
* market share;
* parameter counts;
* context lengths;
* accuracy;
* compute;
* energy usage;
* cost;
* valuation;
* growth percentages.

Do not compare incompatible metrics without qualification.

---

# 10. Technical Claim Verification

For model releases and technical products, verify as many of the following as relevant:

* exact model name;
* release status;
* API vs. downloadable weights;
* model size;
* parameter count;
* architecture;
* modality;
* context window;
* license;
* hardware requirements;
* benchmark methodology;
* inference speed;
* pricing;
* geographic availability;
* customer eligibility;
* preview vs. GA;
* training-data disclosure;
* safety restrictions.

Do not infer "open source" from "open weights."

Do not infer "released" from "announced."

Do not infer general availability from limited preview.

---

# 11. Legal and Regulatory Verification

For laws and regulation, distinguish:

* passage;
* signature;
* enactment;
* effective date;
* operative date;
* compliance deadline;
* enforcement start;
* implementing rules.

Read the underlying legal text when available.

Treat news summaries as interpretation, not substitutes for statutory language.

When sources use "effective" loosely, identify the legally correct term.

---

# 12. Scientific and Research Verification

For research claims:

* retrieve the original paper;
* inspect methodology;
* distinguish preprint from peer-reviewed publication;
* identify whether underlying artifacts are available;
* look for expert review or replication;
* distinguish proof/result from extrapolation;
* identify material human contribution;
* avoid headline inflation.

For mathematical claims, distinguish:

* solved;
* improved a bound;
* generated a conjecture;
* formalized;
* reproduced;
* independently checked.

For benchmark claims, determine whether the benchmark is:

* public;
* private;
* contaminated;
* vendor-run;
* third-party-run;
* independently reproducible.

---

# 13. Contradiction Resolution

When credible sources disagree:

1. state the exact conflicting propositions;
2. determine whether the conflict is factual, terminological, methodological, temporal, or interpretive;
3. assess which source is closest to the event;
4. assess incentives and potential bias;
5. check whether one source relies on another;
6. seek a third source or primary document;
7. explain the most defensible conclusion;
8. retain uncertainty if the evidence remains unresolved.

Do not invent disagreement because:

* publication dates differ;
* one source is more detailed;
* two sources use different but compatible wording.

---

# 14. Claim Ledger

For complex research, maintain an internal claim ledger.

For every major claim:

**Claim**
What exactly is being asserted?

**Evidence**
Which retrieved source supports it?

**Source type**
Primary / independent / repeated / analysis.

**Date type**
Event / announcement / publication / effective / other.

**Status**
Verified / vendor claim / disputed / inferred / unknown.

**Confidence**
High / Medium / Low or numeric.

Do not publish a claim that lacks an evidence entry unless clearly labeled as analysis.

---

# 15. Confidence Calibration

Use confidence as an evidence assessment, not a writing-style signal.

### 9–10 / High

* authoritative primary evidence;
* clear event timing;
* independent confirmation where relevant;
* little material ambiguity.

### 7–8 / Medium-high

* event well established;
* important secondary details remain vendor-reported or incompletely verified.

### 5–6 / Medium

* credible evidence exists but material uncertainty remains.

### 1–4 / Low

* conflicting evidence;
* weak sourcing;
* unverifiable claims;
* unclear timing.

Do not award high confidence merely because several outlets repeat the same source.

---

# 16. Research Depth

## Quick

Fast answer with reliable minimum evidence.

## Standard

Multiple candidate comparison, primary verification, and independent confirmation.

## Deep

Systematic contradiction resolution, alternative candidate exploration, technical/legal source inspection, and cross-source synthesis.

## Maximum

No predefined search or source limit.

Continue until:

* major candidate space has been explored;
* material claims have primary evidence;
* important claims have independent scrutiny;
* contradictions have been investigated;
* ranking is stable;
* additional retrieval is unlikely to change the answer materially.

---

# 17. Stop Condition

Do not stop because:

* the requested number of items has been found;
* one credible source agrees;
* a narrative feels coherent.

Stop when the expected value of another retrieval is low.

Ask internally:

> What fact, if wrong, would most change my answer?

Investigate that fact first.

Then ask:

> What competing candidate could displace my current selection?

Investigate that candidate.

Then:

> What source would most strongly falsify my current conclusion?

Search for it.

Only then finalize.

---

# 18. Output Discipline

Even when research is extensive, the final answer should remain readable.

For ranked research:

### #N — Development

**Event date:**
Exact date where established. Otherwise clearly label announcement/publication date.

**Summary:**
2–3 concise sentences.

**Primary evidence:**
Strongest authoritative source and publication date.

**Independent evidence:**
Prefer evidence that actually tests or corroborates the underlying claim. State explicitly when it merely confirms the announcement.

**Verified facts:**
What can safely be stated as established.

**Claims / unresolved:**
Vendor, government, or other interested-party claims that remain unverified.

**Source disagreement:**
Only genuine material disagreement.

**Why it matters:**
One sentence.

**Confidence:**
Numeric or categorical, with a short evidence-based explanation.

For simpler queries, compress this structure appropriately.

---

# 19. Citation Standard

Every citation must support the specific nearby claim.

Do not:

* cite a homepage when a specific document exists;
* cite an article for a fact it merely repeats without attribution;
* use a secondary article when the requested fact is available directly from the primary source;
* cite search snippets as substantive evidence;
* add citations merely to make the answer look researched.

Prefer fewer, stronger citations over many redundant ones.

---

# 20. Final Adversarial Review

Before answering, challenge the draft.

Ask:

* What is the weakest major claim?
* Which date could be publication rather than event date?
* Which "verified" fact is actually a vendor claim?
* Which supposedly independent sources share the same origin?
* Which number lacks methodology?
* Which candidate was excluded too early?
* Which ranking decision is subjective and should be explained?
* Is there a better primary source?
* Did I confuse open-source with open-weight?
* Did I confuse announcement with release?
* Did I mistake legal effective date for operative requirement?
* Did I overstate what independent reporting established?
* Is any disagreement fabricated by wording or publication timing?
* Would a skeptical domain expert object to any sentence as stronger than the evidence?

Correct all material issues before finalizing.`;

const BALANCED_GUIDE = `# Research Skill — Balanced

## Goal

Produce reliable, current, well-sourced research without unnecessary browsing or verbosity.

## Input

**Question:** Preserve the user's scope in one short sentence.
**Depth:** quick | standard | deep
**Context:** Optional constraints, audience, or output requirements.

## Core Rules

1. Use only evidence retrieved during this session for factual claims that may have changed. Training knowledge may guide search but is not evidence.
2. Resolve relative time expressions before selecting results. Use the user's timezone when relevant.
3. Use focused search queries, normally 3–10 words.
4. Prefer sources in this order:

   * official/primary;
   * original research, filings, legislation, documentation, repositories;
   * high-quality independent reporting;
   * specialist secondary sources.
5. Snippets are discovery aids only. Fetch sources before stating dates, versions, metrics, prices, capabilities, legal obligations, or quotations.
6. Distinguish:

   * event date;
   * announcement date;
   * publication date;
   * effective/operative date;
   * rollout/release date.
7. Separate evidence into:

   * **Verified facts**
   * **Vendor/company claims**
   * **Independent findings**
   * **Interpretation**
   * **Unresolved**
8. A publication repeating a company's claim confirms the announcement, not the underlying claim.
9. For numerical claims, identify who measured them, the comparison baseline, methodology if available, and whether they were independently reproduced.
10. Do not invent disagreements. Report disagreement only when sources actually conflict.
11. For "most important" or ranked tasks:

* define ranking criteria;
* build a candidate pool;
* remove weak or out-of-window candidates;
* rank only after comparison.

12. Stop when additional retrieval is unlikely to change the answer.

## Research Budget

### Quick

* 1–2 searches
* 1 primary fetch
* independent confirmation only if useful

### Standard

* up to 3 initial search angles
* primary source for each major claim
* 1 independent source for consequential claims
* resolve material date/source conflicts

### Deep

Continue only while new retrieval materially improves:

* factual confidence;
* independent verification;
* disagreement resolution;
* candidate selection.

## Confidence

Use confidence only when useful:

* **High / 9–10:** strong primary evidence; material claims well supported.
* **Medium / 6–8:** core event established, but important claims remain vendor-reported or incomplete.
* **Low / 1–5:** key facts remain uncertain or sources conflict materially.

## Output

Start with a 1–3 sentence direct answer.

For substantive findings use:

### Finding

**Date:** exact event date, or clearly labeled announcement/publication date.
**Summary:** 2–3 sentences.
**Primary source:** authoritative source.
**Independent evidence:** source plus what it actually verifies.
**Claims/uncertainty:** only material caveats.
**Why it matters:** one sentence.
**Confidence:** only when useful.

## Final Check

Confirm:

* every current claim is sourced;
* all dates are correctly typed;
* company metrics are labeled;
* independent confirmation is genuinely independent;
* ranking is based on comparison, not discovery order;
* no source is redundant;
* conclusions do not exceed the evidence.`;

const EFFICIENT_GUIDE = `# Research Skill — Token Efficient

## Goal

Answer current research questions accurately with minimal retrieval and minimal output.

## Input

**Question:** Keep close to the user's words, one short sentence.
**Depth:** quick
**Context:** Optional constraints.

## Rules

1. Use only sources retrieved this session for current factual claims. Memory is for search hypotheses only.
2. For relative dates such as "latest," "today," or "past 7 days," determine the current date/time first when needed.
3. Use short search queries, usually 3–8 words.
4. Prefer primary sources first. Search snippets are leads, not evidence for dates, specs, prices, capabilities, legal requirements, or metrics.
5. Retrieve the minimum evidence needed:

   * 1–2 searches;
   * 1 primary source;
   * 1 independent source only when it materially changes confidence.
6. Separate:

   * what happened;
   * what was announced;
   * what an independent source verified.
7. Do not treat a news outlet repeating a vendor number as independent verification of that number.
8. Distinguish event date from publication, announcement, effective, rollout, or operative date.
9. Label important unverified numbers as vendor/company claims.
10. If ranking items, briefly define the ranking criterion and compare several candidates before selecting.
11. Stop once the answer is adequately supported. Do not collect redundant sources.
12. If evidence is insufficient, say so or omit the claim. Never fill gaps from memory.

## Output

Direct answer first in 1–3 sentences.

Then concise bullets containing:

* finding;
* relevant date;
* primary source;
* one important qualification;
* independent source only if useful.

Add **Confidence: High / Medium / Low** only when uncertainty materially affects the answer.

## Final Check

Before answering:

* Is every current claim supported?
* Is the date the actual event date?
* Did I label vendor claims correctly?
* Did I mistake repeated reporting for verification?
* Can I remove any source or sentence without reducing reliability?

If yes, remove it.`;

const INPUT_BLOCK_PATTERN =
    /## Input\n\n\*\*Question:\*\*[^\n]*\n\*\*Depth:\*\*[^\n]*\n\*\*Context:\*\*[^\n]*\n/;

function resolvedInputBlock(input: {
    question: string;
    depth: ResearchDepth;
    context: string;
}): string {
    return `## Input

**Question:** ${input.question}
**Depth:** ${input.depth}
**Context:** ${input.context}
`;
}

/** Build the research skill guide for the active token-mode variant. */
export function buildResearchSkillGuide(input: {
    question: string;
    depth?: ResearchDepth;
    context?: string;
    variant?: ResearchSkillVariant;
}): string {
    const variant = input.variant ?? "balanced";
    const question = input.question.trim().slice(0, 280) || "The user's question";
    const depth = input.depth ?? defaultDepthForVariant(variant);
    const context = input.context?.trim().slice(0, 400) || "none";

    const base =
        variant === "maximum"
            ? MAXIMUM_GUIDE
            : variant === "efficient"
              ? EFFICIENT_GUIDE
              : BALANCED_GUIDE;

    if (variant === "maximum") {
        // The maximum guide has no Input section — insert one after the title.
        const titleEnd = base.indexOf("\n\n") + 2;
        return `${base.slice(0, titleEnd)}## Input

**Question:** ${question}
**Depth:** ${depth}
**Context:** ${context}

${base.slice(titleEnd)}`;
    }

    if (INPUT_BLOCK_PATTERN.test(base)) {
        return base.replace(
            INPUT_BLOCK_PATTERN,
            resolvedInputBlock({ question, depth, context }),
        );
    }

    return `${resolvedInputBlock({ question, depth, context })}\n${base}`;
}
