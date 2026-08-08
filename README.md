# ai.diy <sup>BETA</sup>

[![Clone repository](https://img.shields.io/badge/Clone-GitHub-181717?logo=github)](https://github.com/Cubinghackerz/ai.diy)
[![Deploy a preview](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCubinghackerz%2Fai.diy&project-name=ai-diy-preview)

**The open-source AI workspace you own.**

Local-first, bring-your-own-key chat for Node or Docker. No server-side LLM credentials. Your keys, chats, and memory stay in the browser.

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

- **Available:** landing, chat, 17 providers, model discovery, local persistence, files, browser Python, search + connectors, remote MCP, artifacts, memory, voice dictation (Web Speech), multi-model Preview, import/export, client-side S3/WebDAV/Google Drive backup, portable skills catalog + install, Agent Mode
- **Coming soon:** direct GitHub/Supabase/PostgreSQL adapters, encrypted browser settings, in-app `ask_user` panels, custom-provider capability probing, MCP OAuth

## What You Own

| Component | Location |
| --- | --- |
| Chat UI, settings, history, artifacts, memory, Preview | Browser (localStorage + IndexedDB) |
| Dictation and Python | Browser (Web Speech + Pyodide) |
| LLM relay, model discovery, search, MCP | Node server |
| Provider API keys | Browser only; relayed per request |

Settings are not encrypted at rest today. Protect the browser profile. Treat hosted instances as able to observe keys in transit.

## Skills

Portable skill packages live in [`skills/`](./skills/). Install from **Settings → Skills** (search → Install → available via `/` in the composer).

Flagship starters include Deep Research, Code Review, GitHub Repository Analysis, PDF Analysis, Incident Investigator, and **General Task Solver** (understand → select skills → execute → verify → synthesize).

Authoring guide for agents: [`.cursor/skills/ai-diy-skill-authoring/SKILL.md`](./.cursor/skills/ai-diy-skill-authoring/SKILL.md).

## Agent Mode

Enable under **Settings → Experimental**. The model plans, selects installed skills/tools, verifies, and synthesizes. Pair with General Task Solver. Optional approved **Subagents** remain available for nested runs.

## Available Features

### Providers

OpenAI, Anthropic, Gemini, Groq, OpenRouter, xAI, DeepSeek, Bedrock, Azure, Vertex, Vercel Gateway, Together, Mistral, Hugging Face, Ollama, LM Studio, custom OpenAI-compatible.

### Tools

Web search (DuckDuckGo + connectors), URL fetch, calculator, browser Python, files/artifacts, research and design skills, local time, memory, ask user, remote MCP (Firecrawl + Parallel bundled keyless).

### Import / Export / Backup

ChatGPT, Claude, ShareGPT, Markdown, ai.diy JSON. Client-side backup to S3-compatible storage, WebDAV, or Google Drive (service-account JSON). Credentials stay in the browser and talk only to your storage endpoint.

> Note: an older “Cloud storage coming soon” blurb referred to Google Drive **OAuth**. Client-side S3/WebDAV/Drive service-account backup is available now.

## Security

- No LLM keys in server env
- SSRF guards on `fetch_url` and private provider/MCP URLs (unless `ALLOW_PRIVATE_PROVIDER_URLS=true` on trusted self-host)
- Stdio MCP rejected
- **Add rate limits** before public exposure
- Do not log request bodies or credentials

See [DEPLOYMENT.md](./DEPLOYMENT.md) and `.env.example`.

## Vercel Preview Only

```bash
npx vercel
```

Do not use `--prod` for this beta.

## License

MIT. See [LICENSE](./LICENSE).
