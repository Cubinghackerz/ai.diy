---
name: url-doctor
version: 1.1.0
description: Audit a public webpage URL for health scores plus measured checks (security headers, TLS/HSTS/CSP, robots/sitemap, DNS SPF/DMARC, sample broken links, trackers, schema, and more). Use for URL Doctor, AuditURL, site health, or SEO/a11y audits of a pasted https URL.
category: developer
tools:
  - url_doctor
  - fetch_url
  - ask_user
inputs:
  - name: url
    type: string
    required: true
  - name: focus
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - network
popular: false
---

# URL Doctor (AuditURL)

## Job charter

Fetch one public URL and deliver an honest scored health report: Overall Health plus Security, Performance, SEO, Accessibility, Privacy/Tracking, Links, Conversion, and Reputation/risk—with actionable findings. Prefer measured tool output over guesses.

## When to activate

- User pastes `https://…` and asks to audit, doctor, score health, check SEO/a11y/performance/privacy, or “AuditURL”
- Slash command `/URL Doctor`
- Do **not** use for live exploit attempts, authenticated app crawling, or multi-site competitive war rooms (`competitor-research`)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `url` | yes | Public http(s) URL |
| `focus` | no | Optional emphasis (e.g. SEO only) — still run full `url_doctor`, then highlight |

## Workflow

1. **Extract URL** — Use the explicit URL from the user. If missing/ambiguous, `ask_user` once.
2. **Call `url_doctor`** — Once. Do not answer before the tool returns.
3. **Present scores** — Overall Health + each category /100; map Reputation to Low/Moderate/Elevated Risk using the tool’s score.
4. **Checks table** — Keep the tool’s pass/fail/skip inventory (headers, DNS, robots, sample links, etc.). Do not invent skip-marked items (Safe Browsing, scheduled alerts).
5. **Findings first** — P1–P5 + difficulty + Fix lines from the report.
6. **Re-scan** — Tell the user to run `/URL Doctor` again after fixes. Do not claim historical/scheduled monitoring unless the report says skip.

## Decision rules

- Tool scores are authoritative for this skill; never replace them with training-data guesses.
- Client-rendered SPAs may look weak in static HTML — say so when the report notes empty/non-HTML body.
- Hand code/config security reviews of *repositories* to `security-audit`; this skill is for **live public pages**.
- Refuse attacking third-party systems or bypassing auth.

## Tool rules

- `url_doctor`: required first call; one URL per turn unless the user supplies multiple distinct URLs (then one call each, max 3).
- `fetch_url`: optional follow-up for quotes only.
- `ask_user`: only when no URL can be inferred.

## Output contract

```markdown
# URL Doctor: <final url>

**Overall Health: N/100**

| Category | Score |
| --- | ---: |
| Security | … |
| Performance | … |
| SEO | … |
| Accessibility | … |
| Privacy/Tracking | … |
| Links | … |
| Conversion | … |
| Reputation/risk | … · <Low\|Moderate\|Elevated> Risk |

## Top findings
- …

## Recommended fixes
1. …

## Limits
- …
```

## Validation

- [ ] `url_doctor` was called before the answer
- [ ] Scores match the tool output (not invented)
- [ ] Limits section present
- [ ] No fake Lighthouse/CWV numbers

## Failure handling

- Fetch/SSRF/timeout: report the tool error; suggest a public URL or retry.
- Non-HTML response: explain static signals are limited; still show returned scores.
- Paywall/bot block (HTTP 403/401): state blockage; do not fabricate content.
