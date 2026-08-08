---
name: customer-feedback-analysis
version: 1.0.0
description: Analyze customer feedback from reviews, surveys, support tickets, and interviews to extract themes, sentiment, and prioritized insights. Use for voice-of-customer synthesis and product insight briefs.
category: business
tools:
  - run_python
  - calculator
  - generate_file
  - create_file
  - ask_user
  - memory
inputs:
  - name: task
    type: string
    required: true
  - name: feedback_source
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

# Customer Feedback Analysis

## Job charter

Convert raw customer feedback into prioritized, evidence-backed themes: what hurts, what delights, for whom, and what to do next—without overclaiming statistical precision.

## When to activate

- User provides reviews, NPS/CSAT comments, tickets, interview notes, or app-store text
- Asks for themes, sentiment, churn drivers, or feature demand signals
- Do **not** use for single meeting minutes (`meeting-analysis`) or competitor feature matrices (`competitor-research`) unless feedback is the input

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Insight goal / product area |
| `feedback_source` | no | File path, pasted corpus, or description |

Clarify segment filters (plan tier, persona, region) if relevant.

## Workflow

1. **Inventory corpus** — Count items, date range, channels, known bias (only unhappy ticket filers, etc.).
2. **Normalize** — Deduplicate, language cleanup, attach metadata columns if present.
3. **Code themes** — Inductive clustering: tag each item with 1–3 themes; keep representative quotes.
4. **Sentiment & intensity** — Direction plus severity (blocker vs nice-to-have).
5. **Quantify** — Theme frequencies; break down by segment when data allows.
6. **Prioritize** — Frequency × severity × strategic fit (ask if strategy unknown).
7. **Recommend** — Product/ops actions tied to themes; note evidence strength.

## Decision rules

- Loud ≠ majority: report base rates and channel bias.
- Separate feature requests from bugs from UX confusion.
- Preserve verbatim short quotes for top themes (PII-redacted).
- Do not claim market-wide truth from a small sample—state n.
- If competitive mentions dominate, optionally feed `competitor-research`.

## Tool rules

- `run_python`: clustering aids, frequency tables, simple sentiment heuristics; no need for heavy ML if n is small—manual coding may be better.
- `calculator`: percentages.
- `generate_file` / `create_file`: theme codebook, CSV of tagged rows.
- `memory`: theme taxonomy for longitudinal comparison.

## Output contract

```markdown
# Customer feedback analysis

## Snapshot
n | channels | period | known biases

## Top insights
1. ...

## Theme table
| Theme | Count | % | Sentiment | Severity | Example quote |

## Segment differences
...

## Recommendations
| Priority | Action | Linked themes | Evidence strength |

## Method notes
...
```

## Validation

- [ ] Percentages use correct denominator
- [ ] Quotes exist in source (not paraphrased as quotes)
- [ ] PII redacted
- [ ] Bias/limitations section present
- [ ] Recommendations map to themes

## Failure handling

- **Tiny n (<15)**: qualitative only; avoid fake precision.
- **Mixed languages**: analyze separately or note translation risk.
- **Only star ratings, no text**: limited insights; request comments.
- **Huge corpus**: sample stratified by rating/date; disclose method.
