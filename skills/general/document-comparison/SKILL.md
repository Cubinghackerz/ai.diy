---
name: document-comparison
version: 1.0.0
description: Compare two or more documents to find additions, deletions, semantic changes, and conflicts. Use for contract redlines, policy diffs, proposal versions, and spec drift.
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
  - name: documents
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

# Document Comparison

## Job charter

Produce a clear, structured diff of meaning—not just raw text churn. Highlight material changes, conflicts, and unchanged critical clauses when comparing document versions or related docs.

## When to activate

- User provides two+ versions (contracts, policies, specs, proposals, READMEs) and asks what changed
- Need semantic comparison beyond git diff for prose
- Do **not** use for code PR review (`code-review`) or single-doc PDF Q&A (`pdf-analysis`)—though those may supply extracted text

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Comparison goal (redline summary, risk changes, etc.) |
| `documents` | no | Paths or pasted texts; label A/B/C |

If >2 docs, clarify pairwise baseline (usually oldest → newest).

## Workflow

1. **Normalize** — Extract text (delegate PDF extract patterns to `pdf-analysis` methods if needed); unify encoding; optional section splitting.
2. **Align structure** — Map sections by headings/numbering; note renumbering.
3. **Diff levels** — (a) structural (sections added/removed), (b) textual, (c) semantic (obligation/meaning change).
4. **Classify changes** — Material vs cosmetic (typos, formatting); risk-relevant for legal/policy.
5. **Conflict detect** — Contradictions within a version or across related docs.
6. **Report** — Executive change summary + detailed log; optional side-by-side file.

## Decision rules

- Lead with material changes affecting rights, money, dates, SLAs, liability, security, or scope.
- Cosmetic-only churn goes in an appendix or “ignored” bucket.
- When unsure if legal meaning changed, flag **needs human counsel**—do not give legal advice disguised as certainty.
- Preserve clause IDs when present.
- For three-way merges, identify common ancestor if provided.

## Tool rules

- `run_python`: sequence diff, sentence alignment, hashing sections.
- `create_file` / `generate_file`: redline markdown, change CSV.
- `memory`: baseline version identity for follow-up compares.
- Keep documents local; no network publish.

## Output contract

```markdown
# Document comparison

## Baseline → target
Identities | dates | word/section counts

## Executive summary of changes
...

## Material changes
| ID | Section | Change type | Before | After | Why it matters |

## Cosmetic / non-material
count + examples

## Conflicts / ambiguities
...

## Unchanged critical clauses
(if task asks for assurance)
```

## Validation

- [ ] Every material change cites section anchors
- [ ] Before/after not hallucinated—taken from sources
- [ ] Cosmetic vs material separated
- [ ] Document identities clear
- [ ] Legal disclaimer present when comparing contracts/policies

## Failure handling

- **Scanned PDFs**: extract first; if OCR weak, limit to high-confidence sections.
- **Huge docs**: compare TOC + user-specified sections first.
- **Unrelated documents**: refuse pairwise redline; offer thematic overlap analysis instead.
- **Missing baseline**: ask which is authoritative.
