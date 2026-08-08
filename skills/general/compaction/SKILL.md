---
name: compaction
version: 1.0.0
description: Compress long chat history into a faithful carry-forward brief so the model can continue near the context limit without hallucinations from truncated dumps. Use when the user types /Compaction or asks to compact, compress, or reclaim context.
category: general
tools:
  - compaction_skill
  - memory
  - ask_user
inputs:
  - name: focus
    type: string
    required: false
outputs:
  - name: compacted_brief
    type: markdown
permissions: []
popular: true
---

# Compaction

## Job charter

Turn long prior conversation (including bulky tool results) into a short, faithful carry-forward brief: goals, decisions, constraints, open threads, and retrieved URLs—nothing invented.

## When to activate

- User selects `/Compaction` or asks to compact / compress / reclaim context
- Thread is approaching the model context window (auto-compaction uses this same contract)
- Do **not** use as a general summarizer for arbitrary pasted docs (`summarizer`) or for live research (`web-research`)

## Workflow

1. Call `compaction_skill` first.
2. Keep goals, decisions, constraints, open questions, and cited URLs.
3. Drop chatter, duplicate tool dumps, and failed dead-ends unless they change the plan.
4. Continue the latest user request from the compacted brief + recent uncompacted turns.
5. Remember active tools remain available after compaction.

## Decision rules

- Never invent facts, URLs, versions, or conclusions absent from the source turns.
- Prefer recent messages when they conflict with the compacted brief.
- If critical detail is missing, say what was dropped rather than guessing.

## Output contract

- Brief markdown with Goals, Carry-forward notes, URLs, and a truncated turn digest
- Continue the user task immediately after acknowledging compaction (only if they asked for it)
