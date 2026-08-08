---
name: github-repository-analysis
version: 1.0.0
description: Analyze GitHub repositories for structure, stack, health signals, docs quality, and contribution entry points. Use when onboarding to a repo, evaluating a project, or mapping architecture from GitHub.
category: developer
tools:
  - web_search
  - fetch_url
  - run_python
  - memory
  - ask_user
inputs:
  - name: task
    type: string
    required: true
  - name: repo_url
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - network
  - code_execution
popular: true
---

# GitHub Repository Analysis

## Job charter

Map a GitHub repository’s purpose, architecture, tech stack, maturity signals, and how to contribute or integrate—using public metadata and fetched files, not guesswork.

## When to activate

- User provides a `github.com/org/repo` URL or asks to “analyze this repo”
- Onboarding, due diligence, dependency evaluation, or architecture overview
- Do **not** use for reviewing a single PR diff (`code-review`) or writing API docs from local code only (`api-documentation`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Analysis goal (overview, security posture, “how do I run it”, etc.) |
| `repo_url` | no | Full GitHub URL; extract from `task` if embedded |

## Workflow

1. **Normalize identity** — Parse owner/repo; confirm default branch via `fetch_url` on the repo page or API-like HTML.
2. **Collect surface docs** — Fetch README, LICENSE, CONTRIBUTING, SECURITY.md, CODEOWNERS, .github workflows list when present.
3. **Detect stack** — Inspect manifests: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `Gemfile`, Dockerfiles, lockfiles.
4. **Map structure** — Top-level dirs, entrypoints, apps/packages monorepo layout, important configs.
5. **Health signals** — Recent activity cues from README badges/releases page, CI workflow presence, issue/PR templates, open vs archived state (from page text only—do not invent stars/forks).
6. **Risk & ops** — Secrets patterns in sample env files, deployment hints, required services, known security contacts.
7. **Answer the task** — Tailor depth to the user’s question; store durable facts in `memory`.

## Decision rules

- Prefer fetched README and manifests over model priors about the project.
- If private/404, stop and ask for access or a zip/export.
- Distinguish **observed** (from files) vs **inferred** (reasonable guess)—label inferences.
- For deep security review of code, hand off findings list to `security-audit`.
- For dependency CVE hunting beyond manifests, note limits and suggest dedicated scanners.

## Tool rules

- `fetch_url`: README raw URLs (`/raw/`), tree pages, release notes, workflow YAMLs.
- `web_search`: `"org/repo"` plus topic keywords for related docs/ADRs only when README is thin.
- `run_python`: parse JSON/TOML/YAML text already fetched; do not scrape HTML with brittle parsers unless needed.
- `memory`: cache owner/repo, stack, run commands, architecture summary.

## Output contract

```markdown
# Repository analysis: <owner/repo>

## Snapshot
Purpose | Stack | License | Default branch | Maturity signal

## Architecture map
- Entrypoints
- Packages / services
- Data stores / external deps

## How to run (from docs)
1. ...

## Quality & process
CI | tests | contributing | code ownership

## Risks & gaps
- ...

## Answers to your question
...

## Sources fetched
- url — what extracted
```

## Validation

- [ ] Owner/repo correct
- [ ] Stack claims backed by manifest evidence
- [ ] Run instructions cited from docs or marked inferred
- [ ] No fabricated star counts, commit hashes, or CI status
- [ ] Explicit “not found” for missing standard files

## Failure handling

- **Rate limits / blocked**: fall back to raw.githubusercontent.com; reduce fan-out.
- **Monorepo overwhelm**: analyze path the user cares about; summarize the rest.
- **Sparse README**: reconstruct from manifests + `web_search`; flag low documentation confidence.
- **Ambiguous fork vs upstream**: state which URL was analyzed.
