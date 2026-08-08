---
name: log-analysis
version: 1.0.0
description: Parse and analyze application, system, and access logs to find errors, patterns, anomalies, and actionable signals. Use when debugging from log dumps or correlating events across services.
category: devops
tools:
  - run_python
  - calculator
  - create_file
  - ask_user
  - memory
inputs:
  - name: task
    type: string
    required: true
  - name: log_path
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

# Log Analysis

## Job charter

Turn raw logs into a clear narrative: what happened, how often, where it concentrated, and what to check next. Prefer measurable patterns over anecdotal line reading.

## When to activate

- User pastes logs or provides log files and asks what failed, why, or what’s anomalous
- Need error clustering, latency patterns, auth failure spikes, or request correlation
- Do **not** use as full incident command (`incident-investigator`) or systemic RCA facilitation (`root-cause-analysis`)—feed those skills with your findings

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Question (errors, spike, user X, deploy window) |
| `log_path` | no | File path(s) or inline log text in task |

## Workflow

1. **Identify format** — JSON, CLF, syslog, multiline stack traces; note timezone.
2. **Scope window** — Time range relevant to the incident or question.
3. **Normalize** — Parse to fields: ts, level, service, message, request_id, user, status, latency.
4. **Cluster** — Group by error signature (template out IDs/UUIDs); rank by count and recency.
5. **Correlate** — Link via request_id/trace_id across files when present.
6. **Anomalies** — Rate changes, new error classes, status code shifts, hotspot endpoints.
7. **Conclude** — Top findings + recommended next queries/checks.

## Decision rules

- Always quantify (counts, rates, p50/p95 if latency present).
- Preserve representative sample lines for each cluster—don’t only show aggregates.
- Redact secrets/tokens/session IDs in outputs.
- Multiline Java/Python traces: treat stack root cause frame as signature key.
- If security compromise is suspected, escalate framing to `incident-investigator`.

## Tool rules

- `run_python`: primary parser/aggregator; stream large files in chunks.
- `calculator`: rate math (errors/min).
- `create_file`: normalized CSV/JSON summaries, top-N error reports.
- `memory`: signatures, time window, correlation keys.
- Do not exfiltrate full logs to network tools.

## Output contract

```markdown
# Log analysis

## Answer
...

## Time window & volume
...

## Top error clusters
| Rank | Signature | Count | First | Last | Sample |

## Notable patterns
Latency | status codes | hot keys | deploy correlation

## Recommended next checks
...

## Method
Parsers | filters | redactions
```

## Validation

- [ ] Counts recomputed or spot-checked
- [ ] Signatures not over-collapsed (hiding distinct bugs) or over-split
- [ ] Timezone stated
- [ ] Secrets redacted
- [ ] Samples support the narrative

## Failure handling

- **Huge files**: sample + filter by level/time first; disclose sampling.
- **Unknown format**: show heuristic parse; ask for schema/example of good line.
- **Clock skew across services**: correlate on request_id before time.
- **Encrypted/binary logs**: stop; request decoded text.
