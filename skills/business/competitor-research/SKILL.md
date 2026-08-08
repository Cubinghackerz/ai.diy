---
name: competitor-research
version: 1.0.0
description: Structured competitor and market landscape analysis covering products, pricing signals, positioning, and differentiation. Use for competitive briefs, win/loss prep, and market scans.
category: business
tools:
  - web_search
  - fetch_url
  - generate_file
  - memory
  - ask_user
inputs:
  - name: task
    type: string
    required: true
  - name: competitors
    type: string
    required: false
  - name: our_product
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - network
  - filesystem
popular: false
---

# Competitor Research

## Job charter

Build an evidence-based competitive picture: who competes, what they offer, how they price/position, and where gaps or threats exist—separated clearly from speculation.

## When to activate

- User asks for competitor analysis, market landscape, battlecards, or positioning vs peers
- Evaluating entrants, substitutes, or adjacent products
- Do **not** use for generic web Q&A (`web-research`) or internal decision frameworks without market evidence (`decision-analysis` after this skill)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Goal (battlecard, landscape, pricing scan) |
| `competitors` | no | Named list; otherwise discover |
| `our_product` | no | Anchor for differentiation |

If market segment is unclear, ask once.

## Workflow

1. **Define arena** — Customer segment, job-to-be-done, geography, category boundaries.
2. **Identify players** — Incumbents, challengers, substitutes; cap list (usually 4–8) unless asked for exhaustive.
3. **Collect evidence** — For each: site, pricing page, docs, changelog, G2/Capterra-style reviews, news, job posts (hiring = roadmap signal).
4. **Compare dimensions** — Features, ICP, pricing model, integrations, compliance, GTM motion, strengths/weaknesses.
5. **Synthesize** — Positioning map in prose/table; implications for `our_product` if given.
6. **Deliver** — Brief + optional `generate_file` battlecards.

## Decision rules

- Label every cell as **observed** (cited) vs **inferred**.
- Do not invent pricing; if not public, write “not published” and note signals (e.g. “contact sales”).
- Reviews are biased—treat as directional, quote themes with source dates.
- Prefer recent pages; note if last meaningful update is old.
- Ethical boundary: use only public information; no social-engineering instructions.

## Tool rules

- `web_search` + `fetch_url` for company sites, docs, pricing, news.
- `memory`: competitor list, dimension matrix, open questions.
- `generate_file`: battlecard pack or comparison CSV/markdown.
- Avoid over-fetching marketing blog noise; prioritize product/pricing/docs.

## Output contract

```markdown
# Competitor research: <arena>

## Executive takeaways
3–5 bullets

## Competitor matrix
| Competitor | ICP | Offer | Pricing | Differentiator | Weak spot | Sources |

## Player dossiers
### <name>
Overview | product | pricing | positioning | recent moves | risks to us

## Opportunities & threats
...

## Evidence gaps
...
```

## Validation

- [ ] Named competitors match the defined arena
- [ ] Pricing/features cited or marked unpublished
- [ ] Inferences labeled
- [ ] Dates on time-sensitive claims
- [ ] No confidential/non-public collection advice

## Failure handling

- **Unknown competitors**: discovery search first; confirm list with user if high-stakes.
- **Stealth pricing**: compare packaging tiers qualitatively.
- **Crowded market**: cluster into archetypes; deep-dive top N.
- **Conflicting review data**: report distribution of themes, not fake averages.
