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

Open `http://localhost:3000` (or the port shown in the terminal). Prefer this production build over `npm run dev` (known composer regression in Vite).

### Docker Compose (recommended)

```bash
docker compose up --build
```

Open `http://localhost:3000`.

### Docker (manual)

```bash
docker build -t ai-diy .
docker run -p 3000:3000 ai-diy
```

Ollama on the same machine: set base URL to `http://host.docker.internal:11434/v1` in Settings. With Compose, uncomment `extra_hosts` in `docker-compose.yml` if needed.

### Environment

Copy `.env.example` — no secrets required. Optional:

```bash
CORS_ORIGINS=https://app.example.com,https://beta.example.com
ALLOW_PRIVATE_PROVIDER_URLS=true   # trusted self-host only
NODE_ENV=production
```

## Public deployment

1. Push this repo to any Node-capable host (VPS, Docker, PaaS).
2. **Do not** add LLM API keys to environment variables — users enter keys in the UI.
3. Build with `npm run build`, run with `npm start` (React Router Node SSR).
4. Ollama / localhost models **do not work** for remote users — the server cannot reach the user's machine. Use cloud providers or expose Ollama at a public HTTPS URL.
5. **Add rate limiting and request-size limits** before exposing a public instance. Treat shared demos as credential proxies in transit.

### Features on any host

| Feature | Works |
|---------|-------|
| Cloud providers (OpenAI, Anthropic, …) | Works with user's BYOK key |
| Ollama / localhost custom proxy | Only when the server can reach them (same network / Docker) |
| Python `run_python` tool | Runs in each user's browser through Pyodide |
| Web search, calculator, fetch URL, canvas | Works |
| Chat history | Stored in **user's browser** (IndexedDB) |
| Client-side cloud backup (S3 / WebDAV / Google Drive) | Works in the browser; credentials never leave the client except to the storage endpoint |

### Cross-origin (separate frontend / API domains)

The app is same-origin by default: the browser calls `/api/*` on the same host that renders the UI, so no CORS setup is needed.

If you serve the frontend and API from different origins, set `CORS_ORIGINS` to the comma-separated list of allowed frontend origins. Requests from any other origin are rejected (wildcards are not supported):

```bash
CORS_ORIGINS=https://app.example.com,https://beta.example.com npm start
```

## Vercel Preview Only

Temporary Preview testing only — not a production dependency:

```bash
npx vercel
```

Do not attach a production domain or use `npx vercel --prod` for this beta workspace. No server-side LLM env vars are required.

## Privacy

- API keys and chat history stay in the **user's browser** (localStorage + IndexedDB).
- Keys are sent to **your** server only to proxy requests to the user's chosen provider — they are not stored server-side.
- Do not log request bodies or provider credentials in production.

## Security notes for public deployments

- `fetch_url` blocks private/local network URLs (SSRF guard).
- Provider roots, SearXNG, and remote MCP URLs reject private targets in production unless `ALLOW_PRIVATE_PROVIDER_URLS=true`.
- Stdio MCP is rejected server-side.
- Consider adding rate limiting on `/api/chat` for public instances.
- Users should treat shared public demos like any BYOK client: only use keys they trust the instance with.
