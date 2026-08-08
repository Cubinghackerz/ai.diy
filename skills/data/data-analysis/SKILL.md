---
name: data-analysis
version: 1.0.0
description: Exploratory and confirmatory analysis of tabular datasets—profiling, cleaning, stats, visualizations, and clear findings. Use for CSV/Excel/JSON data questions and metrics.
category: data
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
  - name: data_path
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

# Data Analysis

## Job charter

Answer analytical questions with reproducible Python-backed evidence: profile the data, clean carefully, compute the right metrics, and explain findings with caveats—not chart spam.

## When to activate

- User provides tabular data or asks for EDA, metrics, trends, cohorts, correlations, or forecasts from files
- Need cleaning, joins, aggregations, or statistical summaries
- Do **not** use for SQL-warehouse-first work when queries are the interface (`sql-analyst`), or for PDF table extraction alone (`pdf-analysis`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Business/analytic question |
| `data_path` | no | CSV/TSV/JSON/Parquet/Excel path |

Clarify grain (what one row means) and success metric if missing.

## Workflow

1. **Load & fingerprint** — Shape, dtypes, memory, primary keys, time columns, missingness.
2. **Define grain & metrics** — Restate the question in terms of columns and filters.
3. **Quality checks** — Dupes, impossible values, timezone issues, leakage, censoring.
4. **Clean with audit trail** — Document every filter/imputation; keep raw vs analysis frames.
5. **Analyze** — Aggregations, groupbys, distributions, comparisons, simple models only if needed.
6. **Visualize sparingly** — Only plots that change the conclusion; save via `generate_file`.
7. **Report** — Lead with answer; attach method and limitations.

## Decision rules

- Prefer simpler stats that answer the question over complex models.
- Correlation ≠ causation; label causal language as hypothesis unless design supports it.
- If sample is biased/small, lower confidence and say so.
- For warehouse SQL sources, prefer `sql-analyst` then continue here on result sets.
- Never drop rows silently; report % removed and why.

## Tool rules

- `run_python`: pandas/polars/numpy; plotting libs if available; seed RNGs.
- `calculator`: quick arithmetic checks on reported totals.
- `generate_file` / `create_file`: cleaned datasets, charts, notebooks-lite scripts.
- `memory`: schema, key definitions, metric formulas for follow-ups.
- Avoid downloading arbitrary packages unless environment already supports them.

## Output contract

```markdown
# Data analysis

## Answer
...

## Key metrics
| Metric | Value | Definition |

## Method
Data | grain | filters | period

## Quality notes
Missingness | outliers | exclusions

## Supporting detail
Tables / chart file paths

## Limitations & next steps
...
```

## Validation

- [ ] Metric definitions are explicit
- [ ] Totals reconcile with row counts / filters
- [ ] Spot-check: recompute one key number
- [ ] Exclusions quantified
- [ ] Charts labeled with units and period

## Failure handling

- **Unreadable file / wrong encoding**: try alternates; ask for sample or schema.
- **Ambiguous columns**: ask mapping once; do not invent business meaning.
- **Too large for memory**: sample strategically or aggregate in chunks; disclose sampling.
- **Conflicting user metric def**: state both; recommend one with rationale.
