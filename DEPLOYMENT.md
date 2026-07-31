# Deployment

ai.diy is **BYOK (Bring Your Own Key)**. The hosted app does not need OpenAI/Anthropic/etc. API keys in server environment variables. Users pay their own LLM usage; the deployer pays only hosting (Vercel free tier, or your own server).

## Cost model

| What | Who pays |
|------|----------|
| LLM API calls | **End user** (their key in browser settings) |
| DuckDuckGo web search | Free (server-side scrape) |
| Vercel hosting | **Deployer** (Hobby tier is usually enough for personal demos) |
| Self-hosted VPS | **You** (optional) |

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

- `DISABLE_PYTHON=1` — turn off legacy server Python (browser Pyodide is preferred)

## Deploy to Vercel (free demo / public URL)

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. **Do not** add LLM API keys to Vercel env vars — users enter keys in the UI.
4. Build command: `npm run build`
5. Output: React Router SSR (default Node serverless functions)

### Vercel limitations

| Feature | On vercel.app |
|---------|----------------|
| Cloud providers (OpenAI, Anthropic, …) | Works with user's BYOK key |
| Ollama / localhost custom proxy | **Does not work** (server cannot reach user's machine) |
| Python `run_python` tool | **Disabled** (no python3 in serverless) |
| Web search, calculator, fetch URL, canvas | Works |
| Chat history | Stored in **user's browser** (IndexedDB) |

To use local models, **self-host** ai.diy on the same network as Ollama, or expose Ollama at a public HTTPS URL.

## Privacy

- API keys and chat history stay in the **user's browser** (localStorage + IndexedDB).
- Keys are sent to **your** server only to proxy requests to the user's chosen provider — they are not stored server-side.
- Do not log request bodies in production.

## Security notes for public deployments

- `fetch_url` blocks private/local network URLs (SSRF guard).
- Consider adding rate limiting on `/api/chat` for public instances.
- Users should treat shared `.vercel.app` demos like any BYOK client: only use keys they trust the instance with.
