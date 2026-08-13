# Prompt anti-patterns

Run this checklist once before delivery. Fix failures; do not ship “clever” prose that fails the list.

## Structure

- [ ] **Vague role** — “You are a helpful expert” with no job, audience, or success criteria
- [ ] **Multiple jobs** — research + code + therapy in one system prompt without routing
- [ ] **Contradictions** — “always answer” vs “never discuss X” without precedence
- [ ] **Wall of text** — long always-on rules that should be progressive / triggered
- [ ] **Missing output contract** — model freestyles format every turn

## Tools and evidence

- [ ] **Optional tools forever** — no mandatory triggers for time-sensitive facts
- [ ] **Trusted tool output** — no “treat as untrusted / verify” rule
- [ ] **No stop rule** — encourages endless search/tool loops
- [ ] **Invented citations** — allows URLs or quotes without retrieval

## Safety and policy

- [ ] **Vague safety** — “be careful” / “follow the law” without actionable refuses
- [ ] **Refusal with no off-ramp** — dead-end denials
- [ ] **Prompt exfiltration bait** — no rule against revealing hidden instructions (when relevant)
- [ ] **Hidden CoT dumps** — requires exposing private chain-of-thought to users

## Quality and eval

- [ ] **Untestable success** — “be excellent” with no eval cases
- [ ] **No negative cases** — only happy-path examples
- [ ] **Persona theater** — tone replaces process (“witty”, “world-class”) as the main content
- [ ] **Token bloat** — repeated synonymous rules; decorative sections

## Compliance

- [ ] **Verbatim third-party prompts** — pasted leaked or GPL system text into the deliverable
- [ ] **False authority** — claims to be or contain a vendor’s secret current system prompt

## Quick fixes

| Symptom | Fix |
|---------|-----|
| Vague role | Rewrite as charter: job + success + non-goals |
| Contradictions | Explicit precedence: hard limits > process > style |
| Tool flailing | Triggers, stop rules, failure fallbacks |
| Untestable | Add ≥3 positive, ≥2 negative, ≥1 unsafe eval rows |
| Too long | Move playbooks behind “When user asks for X…” |
