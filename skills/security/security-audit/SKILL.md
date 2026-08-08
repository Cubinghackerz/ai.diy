---
name: security-audit
version: 1.0.0
description: Defensive security review of applications, configs, and architecture for vulnerabilities and control gaps. Use for threat-oriented audits, secure design checks, and remediation prioritization—not exploit development.
category: security
tools:
  - fetch_url
  - run_python
  - create_file
  - ask_user
  - memory
inputs:
  - name: task
    type: string
    required: true
  - name: target
    type: string
    required: false
  - name: threat_model
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - filesystem
  - network
  - code_execution
popular: false
---

# Security Audit

## Job charter

Identify security weaknesses and missing controls in code, configuration, and design. Report risks with severity, exploitability context, and remediation—strictly defensive. Never produce exploit PoCs or attack playbooks.

## When to activate

- User asks for a security review, threat model pass, hardening checklist, or vuln audit of provided code/config
- Pre-release security gate for an app or infra-as-code snippet
- Do **not** use for live incident response (`incident-investigator`) or log forensics alone (`log-analysis`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Scope and goals |
| `target` | no | Paths, snippets, URLs to docs/architecture |
| `threat_model` | no | Assets, attackers, trust boundaries |

Refuse requests to attack third-party systems or write exploits—even “for education” when the ask is operational attack material.

## Workflow

1. **Scope & assets** — What is in scope? Data classes (PII, secrets, payments)? Trust boundaries?
2. **Model threats** — STRIDE-style pass at a high level; list relevant abuse cases.
3. **Review surfaces** — Authn/authz, input handling, cryptography/secrets, data store access, SSRF/XSS/SQLi classes, supply chain, misconfig, logging of sensitive data.
4. **Evidence** — Tie each finding to code/config/doc evidence.
5. **Prioritize** — Impact × likelihood; consider exposure (internet-facing vs internal).
6. **Remediate** — Concrete fixes, control additions, tests to prevent regression.
7. **Residual risk** — What was not reviewed.

## Decision rules

- Severity: **critical** (auth bypass, RCE, mass data leak) → **high** → **medium** → **low** → **info**.
- Missing context ≠ missing vuln: mark as **needs verification** when dynamic proof would be required.
- Prefer secure defaults and least privilege recommendations.
- Secrets found in code: critical/high; recommend rotation—do not echo full secrets in output.
- Hand code-quality-only issues to `code-review` unless they have security impact.

## Tool rules

- `run_python`: secret pattern scans, dependency manifest checks, static regex—**no exploit payloads**.
- `fetch_url`: public docs, OWASP references, vendor security advisories.
- `create_file`: audit report markdown.
- `memory`: scope, findings IDs, open questions.
- Never attempt to authenticate against or attack a live system.

## Output contract

```markdown
# Security audit

## Scope & threat model summary
...

## Executive risk summary
Top risks in plain language

## Findings
### [CRITICAL] <id> <title>
- Evidence
- Impact
- Likelihood / exposure
- Remediation
- Verification test idea (defensive)

## Positive controls observed
...

## Out of scope / not reviewed
...

## Priority remediation plan
1. ...
```

## Validation

- [ ] Each finding has evidence and remediation
- [ ] No exploit code or step-by-step attack chains
- [ ] Secrets redacted
- [ ] Severity consistent with impact
- [ ] Residual scope stated

## Failure handling

- **Insufficient access to code**: produce architecture questionnaire + threat model; partial review.
- **User requests exploitation**: refuse; offer defensive audit only.
- **Huge codebase**: risk-based sampling (auth, parsers, file/url fetchers, admin APIs); disclose coverage.
- **Dependency CVEs without lockfile versions**: list check process; avoid false version claims.
