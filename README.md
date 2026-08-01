# ai.diy <sup>BETA</sup>

> Open-source, BYOK AI chat — self-host on any Node server or Docker. **No API keys required on the server.**

Built with [assistant-ui](https://assistant-ui.com), React Router v8, the Vercel AI SDK, and Tailwind CSS v4.

## What it is

ai.diy is a privacy-first, bring-your-own-key chat interface. It proxies the user's own provider credentials to the LLM, so the deployer never handles API keys and users pay only their providers. Everything is rendered in the browser, including full markdown, math (KaTeX), and inline HTML from model output.

## Features

- **BYOK** — Users bring their own keys (17 providers: OpenAI, Anthropic, Gemini, Groq, OpenRouter, xAI, DeepSeek, Amazon Bedrock, Azure OpenAI, Google Vertex AI, Vercel AI Gateway, Together AI, Mistral, Hugging Face, Ollama, LM Studio, custom). Keys stay in the browser.
- **Live model discovery** — `/api/models` queries each provider with the user's key to return a real-time model catalog; local defaults are only an offline fallback.
- **Free web search** — DuckDuckGo (no search API key) plus optional SearXNG. Server-side results are summarized server-side; nothing is stored.
- **Built-in tools** — Web search, URL fetch, calculator, canvas files, and browser Python via Pyodide. The model receives the execution result and can continue its response automatically.
- **Callable skills** — `create_skill` drafts a `SKILL.md` workflow document, `frontend_design_skill` produces an implementation-ready frontend design brief, and `ultimate_frontend_ui` applies the full frontend implementation/validation contract. These tools are side-effect-free and never access private data.
- **Tool-capable model picker** — Defaults to the live catalog and keeps the user's selection visible across provider switches; searchable command-style picker.
- **Reasoning** — One compact input-bar selector exposes the supported effort levels for the selected model; provider-specific `providerOptions` are used for OpenAI, Anthropic, Gemini, xAI, DeepSeek, Bedrock, and Mistral.
- **Image models** — Vision-capable models accept image attachments. Image-generation models are marked in the picker, expose supported size/count controls, and return generated images inline in chat.
- **Streaming** — Real-time tokens, tool calls, generated files, and reasoning where the selected provider exposes it via the AI SDK UI message stream.
- **Experimental multi-model preview** — An opt-in Settings → Experimental workspace runs up to three models in parallel and can synthesize their completed outputs with a fourth model. Each tab retains its own tool calls, reasoning, images, and artifacts.
- **Auto thread titles** — New chat, first message, the model generates a short title; falls back to a slug if generation fails or the key is missing.
- **Local-first** — Settings in localStorage; chats + messages in IndexedDB.
- **Canvas** — Generated files, HTML, code, and SVG artifacts are saved per chat in IndexedDB, reopen from tool results or the bottom-right Artifacts button, and resize up to 50% of the viewport.
- **Dark / light / system theme**.

## Supported providers

| Provider | Default endpoint | Notes |
|----------|------------------|-------|
| OpenAI | `https://api.openai.com/v1` | GPT-4o/4.1, o3/o4, GPT-5/5.1 |
| Anthropic | `https://api.anthropic.com` | Claude 3/3.5/4/4.5 |
| Google Gemini | `https://generativelanguage.googleapis.com` | Gemini 1.5/2.x/2.5/3 |
| Groq | `https://api.groq.com/openai/v1` | Llama, Mixtral, Qwen |
| OpenRouter | `https://openrouter.ai/api/v1` | Routed models from many providers |
| xAI | `https://api.x.ai/v1` | Grok 1.5/2/3/4 |
| DeepSeek | `https://api.deepseek.com` | DeepSeek Chat / Reasoner / V4 |
| Amazon Bedrock | `https://bedrock-runtime.us-east-1.amazonaws.com` | Claude, Nova, Llama — JSON credentials (`accessKeyId`/`secretAccessKey`/`region`) |
| Azure OpenAI | configurable | Deployment-based — JSON credentials (`resourceName`/`apiKey`) |
| Google Vertex AI | `https://us-central1-aiplatform.googleapis.com` | Gemini + Claude — JSON credentials (`project`/`clientEmail`/`privateKey`) |
| Vercel AI Gateway | `https://ai-gateway.vercel.sh/v4/ai` | One key, many providers |
| Together AI | `https://api.together.xyz/v1` | Kimi, GLM, Qwen, DeepSeek |
| Mistral | `https://api.mistral.ai/v1` | Mistral Medium/Large, Devstral |
| Hugging Face | `https://router.huggingface.co/v1` | Open models via HF Inference |
| Ollama | `http://localhost:11434/v1` | Local, no key |
| LM Studio | `http://localhost:1234/v1` | Local, no key |
| Custom | configurable | Any OpenAI-compatible endpoint, no key |

Multi-credential providers (Bedrock, Azure, Vertex) take structured JSON in the
API key field — the setup screen shows the exact shape. Nothing is stored
server-side; credentials travel only in your browser's requests.

## Quick start (self-host)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm start   # production
```

First run: complete setup, paste your API key (or pick Ollama), pick a model (defaults to the live catalog).

## Beginner VS Code guide

1. Install [VS Code](https://code.visualstudio.com/) and [Node.js 20+](https://nodejs.org/).
2. In VS Code, open **Clone Git Repository** and clone this project.
3. Open the project folder, then open **Terminal → New Terminal**.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open `http://localhost:5173` in your browser.
7. Complete setup and add your own provider key in Settings. Keys stay in your browser.

The browser Python tool uses Pyodide. The first Python run downloads the browser runtime; imports such as `numpy`, `pandas`, `matplotlib`, `scipy`, `sympy`, `sklearn`, `PIL`, `networkx`, `bs4`, `lxml`, `regex`, `dateutil`, and `yaml` are loaded on demand. A local Python installation is not required.

## Copy-paste agent prompt

Use this prompt with a coding agent from the project folder when you want it to run ai.diy locally:

```text
You are working on the ai.diy repository at /Users/nirneet/Documents/GitHub/PrismiumLite.

Run the app locally and verify it before making changes:
1. Inspect package.json and the current git status.
2. Install dependencies with `npm install` if needed.
3. Start the development server with `npm run dev`.
4. Verify that http://localhost:5173 responds.
5. Keep the server running while you investigate or implement the requested task.
6. Run `npm run build` before reporting completion.

Do not add provider API keys to files or environment variables. Preserve BYOK behavior, use the existing design system, and report exact commands, URLs, and validation results.
```

## Deploy anywhere

The app is a plain React Router Node server — run it on any VPS, bare-metal host, or Docker (no serverless platform needed).

1. Push this repo to your server (or use `docker build -t ai-diy .`)
2. `npm install && npm run build && npm start`
3. **Do not** add LLM API keys to environment variables
4. Users open your URL and use their own keys

See [DEPLOYMENT.md](./DEPLOYMENT.md) for details (local models need a host that can reach them, e.g. Ollama on the same machine).

### Environment variables

No secrets are required. See `.env.example`. Optional:

- `CORS_ORIGINS=https://app.example.com` — comma-separated frontend origins permitted to call `/api/*`; same-origin is the default

### Vercel preview only

Self-hosting remains the default deployment path. For a temporary Vercel **preview** (Node runtime, never Edge), deploy a non-`main` branch and omit `--prod`:

```bash
npx vercel
```

This creates a preview URL only and does not update a production domain. Do not use `npx vercel --prod` for this beta workspace. Vercel can label the first deployment of a newly created project as production; if that happens, remove that deployment and run the same command again, which creates a Preview deployment.

## Docker

```bash
docker build -t ai-diy .
docker run -p 3000:3000 ai-diy
```

Python runs in each user's browser through Pyodide; no server Python installation is required.

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
