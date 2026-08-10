# ai.diy <sup>BETA</sup>

[![Clone repository](https://img.shields.io/badge/Clone-GitHub-181717?logo=github)](https://github.com/Cubinghackerz/ai.diy)
[![Deploy a preview](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCubinghackerz%2Fai.diy&project-name=ai-diy-preview)

**The open-source AI workspace you own.**

**Live demo:** [ai-diy-demo.vercel.app](https://ai-diy-demo.vercel.app/)

Local-first, bring-your-own-key chat for Node or Docker. No server-side LLM credentials. Your keys, chats, memory, knowledge base, and Canvas artifacts stay in the browser.

Built with React Router, assistant-ui, the Vercel AI SDK, Tailwind CSS, and browser-side Pyodide.

![ai.diy workspace demo](./public/workspace-demo.gif)

## Demo → Deploy → GitHub

1. **Demo** — open the app and try the workspace
2. **Deploy** — one command (Node or Docker Compose)
3. **GitHub** — [Cubinghackerz/ai.diy](https://github.com/Cubinghackerz/ai.diy)

## Quick Start

```bash
npm install
npm run build && npm start
```

Open `http://localhost:3000` → **Open workspace** → add your API key → chat.

### Docker Compose

```bash
docker compose up --build
```

### Docker (manual)

```bash
docker build -t ai-diy .
docker run -p 3000:3000 ai-diy
```

`npm run dev` is not recommended (composer regression in Vite). Use the production build above. Details: [DEPLOYMENT.md](./DEPLOYMENT.md) · QA checklist: [QA.md](./QA.md).

## Status

Beta. Features marked **available** are wired. **Planned** items are not claimed as working.

- **Available:** landing, chat, 17 providers, model discovery, local persistence, files, browser Python (Canvas capture + IndexedDB persistence for generated images/binaries), search + connectors, remote MCP, artifacts, memory, on-device knowledge RAG, usage ledger with soft spend/token/RPM caps, server rate-limit hooks, voice dictation (Web Speech), multi-model Preview, import/export, client-side S3/WebDAV/Google Drive backup, portable skills catalog + install, slash commands (`/Research`, `/Compaction`, `/Subagent`, …), Agent Mode, subagents (approve → wait → synthesize)
- **Coming soon:** direct GitHub/Supabase/PostgreSQL adapters, encrypted browser settings, custom-provider capability probing, MCP OAuth

## What You Own

| Component | Location |
| --- | --- |
| Chat UI, settings, history, Canvas artifacts, memory, knowledge base, usage events, Preview | Browser (localStorage + IndexedDB) |
| Dictation and Python | Browser (Web Speech + Pyodide) |
| LLM relay, model discovery, search, MCP, optional RPM rate limit | Node server |
| Provider API keys | Browser only; relayed per request |

Settings are not encrypted at rest today. Protect the browser profile. Treat hosted instances as able to observe keys in transit.

## Skills

Portable skill packages live in [`skills/`](./skills/). Install from **Settings → Skills** (search → Install → available via `/` in the composer).

Built-in slash commands force matching tools for the next send — including **`/Subagent`** (spawns approved subagents; the main chat waits for results before continuing), `/Research`, `/Compaction`, and design/file-creation skills. Skill tool calls appear in chat as **Used skill: …**.

Flagship starters include Deep Research, Code Review, GitHub Repository Analysis, PDF Analysis, Incident Investigator, and **General Task Solver** (understand → select skills → execute → verify → synthesize).

Authoring guide for agents: [`.cursor/skills/ai-diy-skill-authoring/SKILL.md`](./.cursor/skills/ai-diy-skill-authoring/SKILL.md).

## Agent Mode & Subagents

Enable Agent Mode under **Settings → Experimental**. The model plans, selects installed skills/tools, verifies, and synthesizes. Pair with General Task Solver.

**Subagents** (same Experimental section, or force with `/Subagent`): the model calls `spawn_subagent` / `spawn_subagents`; you approve each run in a popup; the main chat pauses until those sessions finish (or are declined/cancelled), then continues from structured results. Nested subagents cannot spawn further subagents or ask the user questions.

## Knowledge Base

**Settings → Knowledge Base** uploads documents for private on-device RAG (browser WASM embeddings + HNSW). The model can call `knowledge_search` / `knowledge_list`. Nothing is uploaded to a vendor vector store.

## Usage Guardrails

**Settings → Usage & cost** shows provider-reported tokens/cost and optional soft caps (daily spend, tokens, RPM) keyed by API-key fingerprint in IndexedDB. The server also supports sliding-window RPM limits via `RATE_LIMIT_RPM` / `RATE_LIMIT_DISABLED` (see `.env.example`). Soft caps are client-enforced; configure server limits before public exposure.

## Available Features

### Providers

OpenAI, Anthropic, Gemini, Groq, OpenRouter, xAI, DeepSeek, Bedrock, Azure, Vertex, Vercel Gateway, Together, Mistral, Hugging Face, Ollama, LM Studio, custom OpenAI-compatible.

### Tools

Web search (DuckDuckGo + connectors), URL fetch, calculator, browser Python, files/artifacts, research and design skills, local time, memory, knowledge search, ask user, remote MCP (Firecrawl + Parallel bundled keyless), subagents.

Python saves generated files in the working directory; the browser captures up to four files (≤2 MiB each) into Canvas and persists them with the chat when under the client size cap.

### Import / Export / Backup

ChatGPT, Claude, ShareGPT, Markdown, ai.diy JSON. Client-side backup to S3-compatible storage, WebDAV, or Google Drive (service-account JSON). Credentials stay in the browser and talk only to your storage endpoint.

> Note: an older “Cloud storage coming soon” blurb referred to Google Drive **OAuth**. Client-side S3/WebDAV/Drive service-account backup is available now.

## Security

- No LLM keys in server env
- SSRF guards on `fetch_url` and private provider/MCP URLs (unless `ALLOW_PRIVATE_PROVIDER_URLS=true` on trusted self-host)
- Stdio MCP rejected
- Optional server `RATE_LIMIT_RPM` (enable before public exposure; see `.env.example`)
- Client soft usage caps in Settings → Usage & cost
- Do not log request bodies or credentials

See [DEPLOYMENT.md](./DEPLOYMENT.md) and `.env.example`.

## Vercel Preview Only

```bash
npx vercel
```

Do not use `--prod` for this beta.

## License

MIT. See [LICENSE](./LICENSE).
