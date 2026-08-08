---
name: deep-research
version: 1.0.0
description: Multi-source investigative research with citation tracking, claim triangulation, and structured synthesis. Use for open-ended questions needing depth, evidence, and confidence scoring.
category: research
tools:
  - web_search
  - fetch_url
  - memory
  - generate_file
  - ask_user
inputs:
  - name: task
    type: string
    required: true
  - name: scope
    type: string
    required: false
  - name: depth
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - network
  - filesystem
popular: true
---

# Deep Research

## Job charter

Produce evidence-backed answers to complex questions by searching broadly, reading primary sources, triangulating claims, and synthesizing with explicit confidence and gaps. Prefer depth and provenance over speed.

## When to activate

- User asks for thorough research, a briefing, landscape scan, or “go deep”
- Question spans multiple domains, vendors, papers, or time periods
- Answer quality depends on primary sources, not model memory
- Do **not** use for single-fact lookups (use `fact-checker` or `web-research`) or pure code tasks

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Research question or brief |
| `scope` | no | Constraints: geography, date range, audience, excluded sources |
| `depth` | no | `quick` (~5 sources), `standard` (~10–15), `exhaustive` (until saturation) |

If scope or success criteria are ambiguous, ask once via `ask_user`, then proceed.

## Workflow

1. **Frame the question** — Restate as 1–3 answerable sub-questions. Note assumptions and out-of-scope items.
2. **Plan search angles** — List keyword sets, synonyms, stakeholder viewpoints, and likely primary-source types (docs, filings, papers, standards, official blogs).
3. **Search broadly** — Run `web_search` for each angle. Capture titles, URLs, dates, and why each hit is relevant.
4. **Fetch and extract** — Use `fetch_url` on the best 8–20 sources. Quote or paraphrase key claims with page/section anchors when available.
5. **Triangulate** — Mark each material claim as: supported by ≥2 independent sources, single-source, contested, or unsupported.
6. **Synthesize** — Write a structured brief answering the question; lead with the answer, then evidence, then unknowns.
7. **Persist artifacts** — Optionally `generate_file` a research memo and store key findings in `memory` for follow-ups.
8. **Self-check** — Run Validation before delivery.

## Decision rules

- Prefer primary sources over aggregators; prefer recent official docs over undated blogs.
- If sources conflict, present both sides with dates and incentives; do not average into false certainty.
- Stop searching when new sources repeat the same claims without new evidence (saturation), unless `depth=exhaustive`.
- If the question is decision-shaped, route framing to `decision-analysis` after research is complete.
- If the user only needs a short web skim, defer to `web-research`.

## Tool rules

- `web_search`: discovery only; never cite search snippets as final evidence.
- `fetch_url`: required before quoting or asserting specific facts from a page.
- `memory`: store question frame, source list, and open questions—not raw page dumps.
- `generate_file`: use for long memos (>~800 words) or when user asks for a deliverable file.
- `ask_user`: one clarifying round max unless blockers remain.

## Output contract

```markdown
# Research brief: <title>

## Answer (executive)
<2–5 sentences; direct answer>

## Confidence
Overall: high | medium | low
Key uncertainties: ...

## Findings
### <theme>
- Claim — evidence (source, date) — confidence

## Source map
| # | Source | Type | Date | Role |
|---|--------|------|------|------|

## Contested / unresolved
- ...

## Method notes
Searches run, depth, exclusions
```

Cite sources inline as `[n]` matching the source map.

## Validation

- [ ] Every non-trivial claim maps to ≥1 fetched source
- [ ] Contested claims are labeled, not smoothed over
- [ ] Dates and versions noted where material
- [ ] Answer section stands alone without reading the rest
- [ ] No invented URLs or titles

## Failure handling

- **Paywalled / blocked fetch**: note limitation; use abstracts, secondary citations, or ask user for paste.
- **Thin results**: widen keywords, try alternate spellings/domains; if still thin, deliver with low confidence and gap list.
- **Conflicting authorities**: escalate to comparison table; recommend what would resolve the conflict.
- **Scope explosion**: re-confirm via `ask_user` or truncate to top 3 sub-questions and state cuts.
