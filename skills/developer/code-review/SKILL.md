---
name: code-review
version: 1.0.0
description: Structured code review for correctness, security, maintainability, and test gaps. Use when reviewing diffs, PRs, patches, or asking whether code is safe to merge.
category: developer
tools:
  - fetch_url
  - run_python
  - create_file
  - ask_user
inputs:
  - name: task
    type: string
    required: true
  - name: diff_or_code
    type: string
    required: false
  - name: standards
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - filesystem
  - network
  - code_execution
popular: true
---

# Code Review

## Job charter

Review code changes for defects, security issues, API/contract breakage, readability, and missing tests. Produce actionable findings ordered by severity—not a style lecture.

## When to activate

- User pastes a diff, PR link, patch, or asks “review this”
- Pre-merge or pre-release quality gate
- Do **not** use for greenfield design (architecture advice only when change introduces risk), or for repo-wide health scans (use `github-repository-analysis`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Review goal / PR description |
| `diff_or_code` | no | Inline diff or file contents |
| `standards` | no | Language, style guide, threat model, “must not break X” |

If neither code nor a fetchable PR URL is available, ask once via `ask_user`.

## Workflow

1. **Establish context** — Language, runtime, change intent, blast radius (API, data, auth, concurrency).
2. **Acquire artifact** — Prefer provided diff; if GitHub/GitLab URL given, `fetch_url` the PR/files.
3. **Read for intent** — Summarize what the change claims to do in 2–3 bullets before finding faults.
4. **Defect pass** — Logic errors, edge cases, null/empty handling, race conditions, resource leaks, incorrect error paths.
5. **Security pass** — Injection, authz gaps, secret leakage, unsafe deserialization, path traversal, SSRF, XSS, CSRF, insecure defaults.
6. **Contract & compatibility** — Breaking API/schema changes, migration safety, feature flags, backwards compatibility.
7. **Maintainability & tests** — Clarity, duplication, naming, missing/weak tests, observability (logs/metrics).
8. **Prioritize & report** — Emit Output contract; limit nitpicks unless user asked for style.

## Decision rules

- Severity ladder: **blocker** (must fix) > **major** (should fix before merge) > **minor** > **nit**.
- Prefer concrete evidence (file, symbol, line/hunk) over vague concern.
- If unsure whether behavior is intentional, ask or mark as **question**, not blocker.
- Security issues default to at least **major** unless clearly unreachable.
- Do not rewrite the whole change unless asked; suggest minimal fixes.
- Route pure dependency/supply-chain concerns that need repo topology to `github-repository-analysis`.
- Route production outage forensics to `incident-investigator` / `root-cause-analysis`.

## Tool rules

- `fetch_url`: PR pages, raw file URLs, linked docs—do not invent diffs.
- `run_python`: optional static checks, regex scans for secrets/patterns, small repro scripts.
- `create_file`: optional annotated review notes or suggested patch files when asked.
- Never execute untrusted code from the review target outside a clearly sandboxed `run_python` with user awareness.

## Output contract

```markdown
# Code review

## Summary
Intent: ...
Verdict: approve | approve-with-nits | request-changes | block

## Findings
### [BLOCKER] <title>
- Where: `path` / symbol / hunk
- Why: ...
- Fix: ...

### [MAJOR] ...
### [MINOR] ...
### [NIT] ...
### [QUESTION] ...

## What looks good
- ...

## Test gaps
- ...

## Residual risk
- ...
```

## Validation

- [ ] Verdict matches highest open severity
- [ ] Each finding has location + why + fix direction
- [ ] No fabricated line numbers
- [ ] Security items explicitly called out or marked N/A with reason
- [ ] Praise section is specific (not filler)

## Failure handling

- **Incomplete diff**: review what exists; list unseen areas as residual risk.
- **Generated/minified code**: skip style; focus on interfaces and config.
- **Huge PR**: review by risk areas first (auth, data, public API); state coverage limits.
- **Cannot fetch PR**: ask for diff paste; do not invent review from title alone.
