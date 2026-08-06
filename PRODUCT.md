# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audience is developers and self-hosters evaluating the product. They are technically literate, care about control (own API keys, own data, own model choice), and are deciding whether to adopt it as their everyday AI workspace. Their job on the landing page is to trust it works and get into the workspace quickly.

## Product Purpose

A local-first, bring-your-own-key AI chat workspace. The app does not require server-side LLM credentials; the visitor brings provider keys that stay in the browser, and local storage keeps chats, projects, artifacts, memory, and settings on their machine. Success means the visitor understands it as both a privacy-respecting tool and a genuinely complete workspace (not a demo).

## Positioning

One workspace where every useful model fits the work: 17 providers including local inference (Ollama, LM Studio), BYOK keys that stay local, and local-first storage. The meaningfully different claim is control without compromise — real model freedom plus real privacy plus a real workspace, in one install.

## Operating Context

Self-hosted on a standard Node.js server or Docker. Chat, settings, history, artifacts, memory, and Preview sessions run in the browser using localStorage and IndexedDB. Dictation and Python execution run client-side (Web Speech, Pyodide). A Node server relays LLM requests, model discovery, web search, and URL fetching; provider keys are stored in the browser and sent per-request for relay. Expected: `npm run build && npm start`, landing page at `/`, workspace at `/workspace`.

## Capabilities and Constraints

- Available: chat, provider setup, model discovery, local chat persistence, files, browser Python, web search, connector-backed search, remote MCP, artifacts, local memory, on-device knowledge search, voice dictation, multi-model Preview, chat import/export (ChatGPT, Claude, ShareGPT, Markdown, ai.diy JSON), client-side S3/WebDAV/Google Drive backups, optional AES-GCM encrypted settings, local storage management.
- Coming soon: direct GitHub/Supabase/PostgreSQL adapters, in-app ask_user panels, custom-provider capability probing.
- BYOK trust boundary: no provider key is configured in server env or persisted by the server; a hosted instance can observe keys in transit, so treat deployments as trusted only. Settings persisted in localStorage, not encrypted at rest by default; optional passphrase-encrypted blob (passphrase never stored).

## Brand Commitments

- Product name: **ai.diy**
- Logo: `/ai-diy.png` (workspace and nav usage)
- Copy voice: calm, direct, editorial — "Think clearly. Build openly.", "Make the model fit the work.", "The interface should disappear. The thinking should not."
- Existing content claims (features, providers, bundled Firecrawl/Parallel search) are factual and must be preserved.
- Everything visual about the landing page may change in a redesign; the brand name, logo, and copy voice are untouchable.

## Evidence on Hand

- README.md documents all features, providers, trust boundaries, and run instructions.
- Landing copy in `app/routes/landing.tsx` reflects confirmed claims (provider network list, bundled search, BYOK/local-first framing).
- No testimonials, case studies, pricing, or press exist; must not be fabricated.

## Product Principles

- Control is the product: BYOK, local-first storage, and visible trust boundaries are the core offer, not features listed after the fact.
- A real workspace over a toy demo: the tool's completeness (artifacts, memory, tools, backups) backs the "not a demo" claim.
- Calm, useful thinking: the interface recedes so the work leads; copy is direct and un-hyped.
- Prove, don't claim: capabilities shown concretely (providers, local inference, bundled search) rather than asserted abstractly.

## Accessibility & Inclusion

No product-specific accessibility requirement established.