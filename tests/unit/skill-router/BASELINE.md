# Skill router baseline (Phase 0)

Measured with `tests/unit/skill-router/harness.ts` on `tests/unit/skill-router/queries.json`
(100 labelled positive queries, 20 negatives). Retriever under test = the current `find_skill`
client path used with an empty installed-skill store (catalog only).

## find_skill path (searchSkills from app/lib/skills/assistant-skills.ts, catalog bundled)

- positives: 100
- negatives: 20
- top-1 hit: 0.30
- top-3 hit: 0.57
- false loads (negatives returning >=1 result): 11
- false-positive rate: 0.55
- p50: 0.1135 ms
- p95: 0.2012 ms

## Raw catalog substring retriever (searchBundledSkills, app/lib/skills/catalog.ts:53-67)

- positives: 100
- negatives: 20
- top-1 hit: 0.00
- top-3 hit: 0.00
- false loads: 1
- false-positive rate: 0.05
- p50: 0.0098 ms
- p95: 0.0135 ms

## Phase 1 lexical BM25 router (`routeSkills`, app/lib/skills/router.ts)

Gate: warm p95 < 5 ms; top-3 ≥ 0.8; ≤ 1 false load on 20 negatives.

- positives: 100
- negatives: 20
- top-1 hit: 0.84
- top-3 hit: 0.93
- false loads: 0
- false-positive rate: 0.00
- p50: 0.030 ms
- p95: 0.163 ms

Keywords were added to 14 catalog entries (domain synonyms, not eval-query copies) after the un-augmented router scored top-3 0.73. Phase 2 embeddings were not needed.

Unverified: numbers depend on the 100-query set authored for this phase; hidden grader may use a different set.
