---
name: summarizer
version: 1.0.0
description: Compress long text into accurate, audience-tuned summaries with controllable length and emphasis. Use for articles, threads, docs, reports, and transcripts when the goal is distillation—not deep analysis.
category: general
tools:
  - run_python
  - create_file
  - generate_file
  - ask_user
  - memory
inputs:
  - name: task
    type: string
    required: true
  - name: source
    type: string
    required: false
  - name: length
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - filesystem
  - code_execution
popular: false
---

# Summarizer

## Job charter

Produce faithful, useful summaries that preserve key claims, numbers, decisions, and caveats—matched to the requested length and audience—without injecting new facts.

## When to activate

- User asks to summarize, TL;DR, condense, or executive-brief a provided text
- Need multi-level summaries (headline → bullets → detail)
- Do **not** use for PDF extraction plumbing (`pdf-analysis`), meeting action mining (`meeting-analysis`), comparative redlines (`document-comparison`), or research that requires new sources (`web-research` / `deep-research`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Audience, focus, or “what to emphasize” |
| `source` | no | Pasted text or file path |
| `length` | no | e.g. `tweet`, `5 bullets`, `1 paragraph`, `1 page` |

If audience or length missing, default to ~6 bullets for a general reader; ask only if source is huge and focus is ambiguous.

## Workflow

1. **Scope** — Identify document type, length, and user focus (decisions, numbers, risks, narrative).
2. **Acquire text** — Use provided source; for PDFs, expect extracted text or hand off extraction to `pdf-analysis`.
3. **Map structure** — Headings, sections, argument arc; note what is central vs peripheral.
4. **Extract must-keep** — Claims, figures, named entities, decisions, deadlines, caveats, contradictions.
5. **Draft summary** — Match `length`; lead with the answer/thesis, then supporting points.
6. **Fidelity pass** — Remove invented detail; restore omitted caveats that change meaning.
7. **Deliver** — Optional longer “expanded notes” section if user may need drill-down; optional file export.

## Decision rules

- Never add facts not present in the source; mark inferences as such.
- Preserve quantitative precision (do not round away material digits unless asked).
- If the source is opinionated, attribute views—“Author argues…”—do not launder into objective fact.
- For conflicting statements in-source, surface both.
- Prefer the user’s focus over generic coverage when length is tight.
- Sensitive PII: omit or redact unless required for the task.

## Tool rules

- `run_python`: chunk long docs, count tokens/words, extract headings.
- `create_file` / `generate_file`: summary deliverable when asked.
- `memory`: running summary across multi-part sources.
- No network required for summarization itself; do not fetch replacements for missing text.

## Output contract

```markdown
# Summary

## TL;DR
1–3 sentences

## Key points
- ...

## Notable details
numbers | names | dates | decisions (if present)

## Caveats / open issues
(from source)

## Coverage notes
what was de-emphasized due to length
```

## Validation

- [ ] No new facts introduced
- [ ] Length matches request (or stated default)
- [ ] Critical caveats retained when they affect meaning
- [ ] Numbers/names checked against source
- [ ] Audience tone appropriate (exec vs technical)

## Failure handling

- **Empty/missing source**: request text or path; offer a paste template.
- **Extremely long source**: hierarchical summary (doc → sections); disclose skim limits.
- **Scanned/garbled OCR**: summarize high-confidence spans; flag low-confidence regions.
- **User wants analysis, not summary**: hand off to the appropriate specialist skill.
