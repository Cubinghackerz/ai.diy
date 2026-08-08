---
name: meeting-analysis
version: 1.0.0
description: Turn meeting transcripts or notes into structured summaries—decisions, action items, owners, deadlines, and open questions. Use after meetings or on call transcripts.
category: business
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
  - name: transcript
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

# Meeting Analysis

## Job charter

Extract signal from meeting transcripts/notes: purpose, decisions, action items with owners and due dates, risks, and unresolved questions. Minimize fluff; maximize accountability clarity.

## When to activate

- User pastes a transcript, call notes, or recording summary and wants minutes / actions
- Need to compare what was decided vs parked
- Do **not** use for customer feedback corpora (`customer-feedback-analysis`) or multi-doc diffing (`document-comparison`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Desired output (minutes, actions only, exec summary) |
| `transcript` | no | Full text or file path |

If speakers are unlabeled, ask whether to infer from context or keep as Speaker N.

## Workflow

1. **Orient** — Meeting title/date/attendees if present; inferred purpose in one sentence.
2. **Segment** — Topic sections chronologically or by agenda.
3. **Extract decisions** — Only explicit agreements (“we’ll”, “decided”, “approved”).
4. **Extract actions** — Owner, task, due date, dependencies; mark missing fields as TBD.
5. **Capture risks & blockers** — Separate from actions.
6. **Open questions** — Unresolved debates.
7. **Deliver** — Tailor length to audience (exec vs working team); optional file export.

## Decision rules

- Do not invent owners or deadlines—use `TBD` and flag.
- Distinguish decision vs suggestion vs parking lot.
- Prefer participant-identifiable actions (“Alex will…”) over “team will…”.
- Sensitive HR/personal content: summarize carefully; omit unnecessary personal details.
- If transcript is customer interview-heavy, consider also routing themes to `customer-feedback-analysis`.

## Tool rules

- `run_python`: split large transcripts, detect action-like sentences, dedupe.
- `create_file` / `generate_file`: minutes markdown, CSV of actions.
- `memory`: action list for follow-up meetings.
- No network required; do not upload transcripts externally.

## Output contract

```markdown
# Meeting notes: <title / date>

## Summary
3–6 sentences

## Decisions
- ...

## Action items
| Owner | Action | Due | Status |

## Risks / blockers
- ...

## Open questions
- ...

## Agenda topics covered
- ...
```

## Validation

- [ ] Every action has owner or explicit TBD
- [ ] Decisions are traceable to transcript language
- [ ] No fabricated attendees or dates
- [ ] Parking-lot items not labeled as decisions
- [ ] Length appropriate to request

## Failure handling

- **Noisy ASR transcript**: note low confidence spans; avoid over-precise quotes.
- **Multiple meetings concatenated**: split if detectable; else ask.
- **Missing transcript**: request notes bullets; offer template for live capture.
- **Conflicting decisions in text**: list both with timestamps; mark unresolved.
