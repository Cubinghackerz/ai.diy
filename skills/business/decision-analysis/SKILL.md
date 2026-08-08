---
name: decision-analysis
version: 1.0.0
description: Structure decisions with options, criteria, trade-offs, risks, and a clear recommendation. Use for product, ops, hiring, vendor, and strategy choices when the user needs a decision frame—not just research.
category: business
tools:
  - ask_user
  - memory
  - generate_file
  - create_file
  - calculator
  - web_search
  - fetch_url
inputs:
  - name: task
    type: string
    required: true
  - name: options
    type: string
    required: false
  - name: constraints
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

# Decision Analysis

## Job charter

Turn an ambiguous choice into a decision-ready brief: framed decision, options, weighted criteria, evidence-backed scores, risks, and a recommendation with conditions to revisit.

## When to activate

- User asks what to choose, how to decide, trade-off analysis, or “should we X or Y”
- Need a decision matrix, go/no-go, or vendor shortlist ranking
- Do **not** use as a substitute for market facts (`competitor-research` / `deep-research` first) or pure summarization (`summarizer`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Decision to make / success definition |
| `options` | no | Named alternatives; otherwise propose |
| `constraints` | no | Budget, time, must-haves, non-negotiables |

If decision owner, deadline, or must-have criteria are unclear, ask once.

## Workflow

1. **Frame the decision** — Decision statement, owner, deadline, irreversible vs reversible.
2. **Clarify success** — Outcomes that matter; separate must-haves from nice-to-haves.
3. **Enumerate options** — Include status quo / “do nothing” when relevant; cap at ~5 unless asked.
4. **Set criteria** — 4–8 criteria; assign weights (sum 100%) with rationale.
5. **Gather facts** — Use known inputs; for missing market/product facts, fetch via `web_search`/`fetch_url` or note assumptions. Pull competitor landscape from `competitor-research` if needed.
6. **Score & trade off** — Score options against criteria; call out deal-breakers (must-have fails).
7. **Risks & reversibility** — Downside scenarios, leading indicators, kill criteria.
8. **Recommend** — One primary path + runner-up; state what would change the recommendation.

## Decision rules

- Do not average incompatible goals into a false “balanced” pick—surface the conflict.
- Must-have failures eliminate options regardless of weighted score.
- Label scores as judgment when hard data is missing; never fake precision.
- Prefer reversible experiments when uncertainty is high and cost of trial is low.
- Separate analysis (facts) from recommendation (values/priorities)—ask if values conflict.
- Ethical/legal hard stops override optimization.

## Tool rules

- `ask_user`: criteria weights, constraints, risk tolerance—one clarifying round preferred.
- `calculator`: weight × score math; show arithmetic when close calls.
- `web_search` / `fetch_url`: only for material unknown facts; cite what you fetch.
- `generate_file` / `create_file`: decision memo or matrix CSV when asked.
- `memory`: frame, options, criteria for multi-turn refinement.

## Output contract

```markdown
# Decision analysis: <decision>

## Decision frame
Statement | owner | deadline | reversible?

## Options
1. ...
2. ...

## Criteria & weights
| Criterion | Weight | Why |

## Evaluation
| Criterion | Opt A | Opt B | ... |

## Recommendation
Primary: ...
Why: ...
Runner-up: ...
Revisit if: ...

## Risks & mitigations
...

## Assumptions & open questions
...
```

## Validation

- [ ] Decision statement is a choice, not a vague goal
- [ ] Weights sum to ~100%
- [ ] Must-haves applied before soft scoring
- [ ] Recommendation follows from the matrix (or explains override)
- [ ] Assumptions listed; no invented quotes/prices

## Failure handling

- **Options unknown**: propose 3–4 plausible ones; ask which to keep.
- **Values conflict among stakeholders**: present Pareto options; do not fake consensus.
- **Insufficient data**: recommend information-gathering step or reversible pilot.
- **Already decided**: shift to implementation risks and success metrics instead of re-litigating.
