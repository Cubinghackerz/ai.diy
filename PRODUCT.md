# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Technical self-hosters evaluating ai.diy: developers and privacy-minded people who want a capable AI chat workspace without surrendering their provider keys, their data, or their infrastructure. They compare against hosted SaaS chat apps, other BYOK clients, and self-hosted toolkits. They value ownership, control, transparency, and the ability to swap providers freely.

## Product Purpose

ai.diy is a local-first, bring-your-own-key AI chat workspace for self-hosting on a standard Node.js server or Docker. The server needs no LLM credentials. Users bring their own provider keys (OpenAI, Anthropic, Gemini, local Ollama/LM Studio, and many more), and everything - chats, files, artifacts, memory, preview sessions - persists in the browser via IndexedDB and localStorage.

Success for the landing page: a technical visitor understands within seconds that this is a BYOK, local-first workspace they can self-host, and acts (opens the workspace / starts the setup).

## Positioning

The claim a neighboring product could not copy truthfully: a self-hosted AI workspace where no LLM key ever needs to live on the server, where the provider list spans cloud and local models, and where the user's conversation data stays in their own browser. The user picks the model; the product keeps out of the way.

## Operating Context

- Runs on a standard Node.js server or Docker; no server-side LLM credentials required.
- Browser-side persistence: chats, messages, artifacts, memory, and preview sessions in IndexedDB; settings and keys in localStorage.
- Provider API keys are stored in the browser and relayed per request to the chosen provider endpoint through the Node server.
- Supports 17 provider integrations (OpenAI, Anthropic, Gemini, Groq, OpenRouter, DeepSeek, Bedrock, Azure, Vertex, Vercel Gateway, Together, Mistral, Hugging Face, LM Studio, xAI, Ollama, custom OpenAI-compatible).
- Free web search from the start via bundled keyless MCP servers (Firecrawl, Parallel).
- Voice dictation via browser Web Speech; Python execution via browser-side Pyodide.
- Import/export: ChatGPT, Claude, ShareGPT, Markdown, ai.diy JSON.

## Capabilities and Constraints

Confirmed functionality (from README and code):
- Streaming chat, provider reasoning, reasoning-effort controls, image and video generation models.
- Files, canvas artifacts, model hover cards with capability/price data from models.dev.
- Tools: web search, URL fetch, calculator, browser Python, files, research skill, skills, local time, memory, ask user, remote MCP.
- Local usage and cost tracking; import/export; S3/WebDAV/Google Drive cloud backup (client-side).
- Multi-model preview workspace (experimental).
- Light, dark, and system themes.
- The workspace route is `/workspace`; the landing page is `/`.

Known constraints:
- `npm run dev` has a known composer input regression; production build (`npm run build && npm start`) is the supported local path.
- Settings are not encrypted at rest in the browser today.
- Security posture: LLM keys proxied in transit only, private-network URL rejection, no stdio MCP, redirects rejected.

## Brand Commitments

- Product name: ai.diy (logo asset `public/ai-diy.png`).
- Voice: calm, direct, technical, no hype; "open tools for useful thinking."
- Landing page copy and factual claims follow the Resend-dark redesign brief (ownership headline, BYOK subhead, real deploy commands). Do not fabricate metrics, customers, or package names.
- Provider brand marks use bundled assets in `public/landing-logos/` and Simple Icons where applicable; Firecrawl and Parallel logos exist in `public/`.
- Landing visual world: Resend-dark (pitch black, zinc hairlines, Geist, white CTAs). Workspace identity tokens may differ.

## Evidence on Hand

- README.md documents all product facts, features, trust boundary, and environment variables (authority for claims).
- `public/ai-diy.png` logo, `public/firecrawl-{dark,light}.png`, `public/parallel-{dark,light}.png`.
- 17-provider network, bundled MCP search, local memory/artifacts/backup features all implemented and runnable.
- No testimonials, customers, pricing, or benchmark data exist; must not be fabricated.

## Product Principles

1. Ownership first: the user's keys, data, and infrastructure stay under the user's control; the page must make this visible, not just claim it.
2. Respect the technical audience: show real specifics (providers, protocols, storage) without dumbing them down or hyping them up.
3. Calm competence: the interface disappears, the thinking does not; expression serves clarity.
4. Local-first honesty: browser persistence, self-hosting, and no-server-keys are the mechanism, and the design should dramatize that mechanism.
5. One workspace, every model: provider freedom is the product's superpower and deserves visual emphasis.

## Accessibility & Inclusion

- WCAG AA contrast for body and interactive text; AAA target for hero copy.
- Both light and dark themes supported; respect `prefers-color-scheme`.
- Motion must honor `prefers-reduced-motion`.
- Keyboard focus-visible states everywhere.
