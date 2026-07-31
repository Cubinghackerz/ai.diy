# ai.diy

> Open-source, BYOK AI chat — self-host or deploy free on Vercel. **No API keys required on the server.**

Built with [assistant-ui](https://assistant-ui.com), React Router v8, Vercel AI SDK, and Tailwind CSS v4.

## Features

- **BYOK** — Users bring their own keys (OpenAI, Anthropic, Gemini, Groq, OpenRouter, Ollama, custom). Keys stay in the browser.
- **Free web search** — DuckDuckGo (no search API key)
- **Tools** — Web search, URL fetch, calculator, canvas files; Python via browser Pyodide when enabled
- **Tool-capable models only** — Model picker filters to models that support function calling
- **Reasoning** — Thinking effort control when the model supports it
- **Streaming** — Real-time tokens + reasoning in the UI
- **Local-first** — Settings in localStorage; chats + messages in IndexedDB
- **Dark / light theme**

## Quick start (self-host)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm start   # production
```

First run: complete setup, paste your API key (or pick Ollama), pick a **tool-capable** model.

## Deploy free on Vercel

1. Fork / import repo on [Vercel](https://vercel.com)
2. **Do not** add LLM API keys to environment variables
3. Users open your `*.vercel.app` URL and use their own keys

See [DEPLOYMENT.md](./DEPLOYMENT.md) for limits (no localhost Ollama, no server Python on Vercel).

## Docker

```bash
docker build -t ai-diy .
docker run -p 3000:3000 ai-diy
```

Includes Python 3 for the `run_python` tool.

## Architecture

```
app/
├── routes/
│   ├── home.tsx           # Chat shell
│   ├── api.chat.ts        # BYOK streaming + tools
│   ├── api.models.ts      # Live model catalog
│   └── api.title.ts       # Auto thread titles
├── components/assistant-ui/
│   ├── Thread.tsx         # Messages + composer
│   ├── AssistantRuntimeProvider.tsx
│   └── ChatThreadSync.tsx # IndexedDB + canvas sync
└── lib/
    ├── server/            # Tools, prompts, SSRF guard
    ├── chat-store.ts      # Message persistence
    └── model-capabilities.ts
```

## Cost to you as deployer

| Item | Cost |
|------|------|
| LLM usage | **$0** — users pay their providers |
| Search | **$0** — DuckDuckGo |
| Vercel Hobby | **$0** for small personal demos |

## License

MIT — see [LICENSE](./LICENSE)
