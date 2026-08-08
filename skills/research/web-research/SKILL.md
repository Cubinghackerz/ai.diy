---
name: web-research
version: 1.0.0
description: Fast, focused web research with source fetching and concise briefs. Use for timely lookups, product/docs questions, and lightweight surveys—not multi-day investigations.
category: research
tools:
  - web_search
  - fetch_url
  - memory
  - ask_user
inputs:
  - name: task
    type: string
    required: true
  - name: max_sources
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - network
popular: false
---

# Web Research

## Job charter

Deliver accurate, cited answers from the live web quickly. Search, fetch, extract, and summarize—optimized for speed and clarity rather than exhaustive coverage.

## When to activate

- User needs current information, docs lookup, “what does X say”, or a short landscape
- Time-sensitive topics (versions, pricing pages, release notes)
- Do **not** use for deep multi-angle investigations (`deep-research`), claim verification campaigns (`fact-checker`), or competitor war-rooms (`competitor-research`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Question or topic |
| `max_sources` | no | Default 5–8 fetched pages |

## Workflow

1. **Refine query** — Extract entities, version constraints, geography.
2. **Search** — 2–4 `web_search` queries with varied phrasings.
3. **Select** — Pick diverse, authoritative URLs; skip SEO junk and duplicate mirrors.
4. **Fetch** — `fetch_url` top candidates; extract only task-relevant passages.
5. **Synthesize** — Short brief with citations; note freshness (page dates).
6. **Cache** — Store durable facts in `memory` when useful for the session.

## Decision rules

- Official docs > vendor blogs > news > forums; use forums only for anecdotal signals.
- If results conflict, prefer primary source and mention the conflict in one line.
- If task expands beyond ~10 sources or needs triangulation depth, upgrade to `deep-research`.
- Pricing/legal claims: quote and date-stamp; warn they change.

## Tool rules

- Never cite from search snippets alone—fetch first.
- Cap fetches near `max_sources` unless pages fail.
- `ask_user` only if the query is ambiguous between two distinct intents.

## Output contract

```markdown
# Web research: <topic>

## Answer
...

## Sources
1. Title — URL — date — key takeaway

## Notes / caveats
Freshness, conflicts, paywalls
```

## Validation

- [ ] Each factual bullet tied to a fetched source
- [ ] URLs real and matched to titles
- [ ] Stale pages flagged when relevant
- [ ] Answer length proportional to question (usually ≤400 words)

## Failure handling

- **Thin SERP**: rephrase; add site: filters; if still thin, say so.
- **Fetch failures**: try alternate URL (docs version roots); note gaps.
- **Geo-blocked content**: disclose; use regional alternatives if available.
