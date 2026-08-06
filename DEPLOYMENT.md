# Deployment

ai.diy is **BYOK (Bring Your Own Key)**. The hosted app does not need OpenAI/Anthropic/etc. API keys in server environment variables. Users pay their own LLM usage; the deployer pays only hosting.

## Cost model

| What | Who pays |
|------|----------|
| LLM API calls | **End user** (their key in browser settings) |
| DuckDuckGo web search | Free (server-side scrape) |
| Hosting (VPS / bare metal / Docker) | **You** |

**No paid third-party APIs are required** to run this project.

## Self-host (recommended for Ollama / local models)

### Requirements

- Node.js 20+
- Optional: Ollama running locally for offline models
### Quick start

```bash
npm install
npm run build
npm start
```

Open `http://localhost:3000` (or the port shown in the terminal).

### Docker

```bash
docker build -t ai-diy .
docker run -p 3000:3000 ai-diy
```

Ollama on the same machine: set base URL to `http://host.docker.internal:11434/v1` in Settings.

### Environment

Copy `.env.example` — no secrets required. Optional:


## Public deployment

1. Push this repo to any Node-capable host (VPS, Docker, PaaS).
2. **Do not** add LLM API keys to environment variables — users enter keys in the UI.
3. Build with `npm run build`, run with `npm start` (React Router Node SSR).
4. Ollama / localhost models **do not work** for remote users — the server cannot reach the user's machine. Use cloud providers or expose Ollama at a public HTTPS URL.

### Features on any host

| Feature | Works |
|---------|-------|
| Cloud providers (OpenAI, Anthropic, …) | Works with user's BYOK key (direct from browser) |
| Ollama / localhost custom proxy | Only when the *browser* can reach them (same network, public HTTPS, or localhost for local users) |
| Python `run_python` tool | Runs in each user's browser through Pyodide |
| Web search, calculator, fetch URL, canvas | Works (web search + calc fully; fetch_url limited by browser CORS) |
| Chat history | Stored in **user's browser** (IndexedDB) |

### Browser-direct architecture (no API proxy)

Chat, model discovery, web search (DDG + connectors), and fetch_url run directly from the browser to the provider or service using the user's key. The Node server only serves the UI (static or SSR). No server-side proxy of LLM requests or keys exists.

CORS configuration for `/api/*` is not used. Provider and connector endpoints must accept requests from the browser (standard for public cloud providers; self-hosted like Ollama/SearXNG still require the browser to reach them).

## Privacy

- API keys and chat history stay in the **user's browser** (localStorage + IndexedDB).
- Keys are sent directly from the browser to the user's chosen provider or connector — ai.diy never relays or stores them.
- Do not log request bodies in production.

## Security notes for public deployments

- `fetch_url` (client-side) is subject to browser CORS and cannot access private networks.
- For full server-side guards (SSRF on fetch_url, etc.) use a self-hosted deployment that adds its own protections if exposing public access.
- Users should treat shared public demos like any BYOK client: only use keys they trust the instance with.
