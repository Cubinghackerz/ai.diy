# ai.diy

> Open-source, BYOK AI chat — self-host or deploy free on Vercel. **No API keys required on the server.**

Built with [assistant-ui](https://assistant-ui.com), React Router v8, the Vercel AI SDK, and Tailwind CSS v4.

## What it is

ai.diy is a privacy-first, bring-your-own-key chat interface. It proxies the user's own provider credentials to the LLM, so the deployer never handles API keys and users pay only their providers. Everything is rendered in the browser, including full markdown, math (KaTeX), and inline HTML from model output.

## Features

- **BYOK** — Users bring their own keys (OpenAI, Anthropic, Gemini, Groq, OpenRouter, xAI, Ollama, custom). Keys stay in the browser.
- **Live model discovery** — `/api/models` queries each provider with the user's key to return a real-time model catalog; local defaults are only an offline fallback.
- **Free web search** — DuckDuckGo (no search API key) plus optional SearXNG. Server-side results are summarized server-side; nothing is stored.
- **Built-in tools** — Web search, URL fetch, calculator, canvas files, and Python (Pyodide in the browser on Vercel; server Python on self-host/Docker).
- **Callable skills** — `create_skill` drafts a `SKILL.md` workflow document, and `frontend_design_skill` produces an implementation-ready frontend design brief. Both are side-effect-free and never access private data.
- **Tool-capable model picker** — Defaults to the live catalog and keeps the user's selection visible across provider switches.
- **Reasoning** — Thinking effort control (off/low/medium/high) when the selected model supports it; provider-specific `providerOptions` for OpenAI, Anthropic, Gemini, and xAI.
- **Streaming** — Real-time tokens + reasoning in the UI via the AI SDK UI message stream.
- **Auto thread titles** — New chat, first message, the model generates a short title; falls back to a slug if generation fails or the key is missing.
- **Local-first** — Settings in localStorage; chats + messages in IndexedDB.
- **Canvas** — Generated HTML, code, and SVG artifacts render in a resizable side panel.
- **Dark / light / system theme**.

## Supported providers

| Provider | Models API | Notes |
|----------|-----------|-------|
| OpenAI | `https://api.openai.com/v1` | GPT-4o, o1/o3/o4, GPT-5 |
| Anthropic | `https://api.anthropic.com` | Claude 3/3.5/4 |
| Google Gemini | `https://generativelanguage.googleapis.com` | Gemini 1.5/2.x/2.5 |
| Groq | `https://api.groq.com/openai/v1` | Llama, Mixtral, Qwen |
| OpenRouter | `https://openrouter.ai/api/v1` | Routed models from many providers |
| xAI | `https://api.x.ai/v1` | Grok 1.5/2/mini |
| Ollama | `http://localhost:11434/v1` | Local, no key |
| Custom | configurable | Any OpenAI-compatible endpoint, no key |

## Quick start (self-host)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm start   # production
```

First run: complete setup, paste your API key (or pick Ollama), pick a model (defaults to the live catalog).

## Deploy free on Vercel

1. Fork / import repo on [Vercel](https://vercel.com)
2. **Do not** add LLM API keys to environment variables
3. Users open your `*.vercel.app` URL and use their own keys

See [DEPLOYMENT.md](./DEPLOYMENT.md) for limits (no localhost Ollama, no server Python on Vercel).

### Environment variables

No secrets are required. See `.env.example`. Optional:

- `DISABLE_PYTHON=1` — turn off legacy server Python (browser Pyodide is preferred)

## Docker

```bash
docker build -t ai-diy .
docker run -p 3000:3000 ai-diy
```

Includes Python 3 for the `run_python` tool.

## Security

- **SSRF guard** — `fetch_url` blocks localhost and private network URLs.
- **Keys in browser only** — API keys are forwarded per request and never stored server-side.
- **Rate limiting** — recommended on `/api/chat` for public instances (see `DEPLOYMENT.md`).
- **No logging of request bodies** in production.

## Developer notes

- `npm run build` — production build (React Router SSR).
- `npm run typecheck` — `react-router typegen && tsc`. The generated `.react-router/types/**` route modules are known to emit path-resolution noise during typecheck; the production build is the source of truth.
- The `.agents/` and `.kilo/` folders hold agent/skill scaffolding and are not part of the shipped app.

## License

MIT — see [LICENSE](./LICENSE)
