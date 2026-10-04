# Deployment

ai.diy is **BYOK (Bring Your Own Key)**. The hosted app does not need OpenAI/Anthropic/etc. API keys in server environment variables. Users pay their own LLM usage; the deployer pays only hosting.

## Cost model

| What                                | Who pays                                     |
| ----------------------------------- | -------------------------------------------- |
| LLM API calls                       | **End user** (their key in browser settings) |
| DuckDuckGo web search               | Free (server-side scrape)                    |
| Hosting (VPS / bare metal / Docker) | **You**                                      |

**No paid third-party APIs are required** to run this project.

## Self-host (recommended for Ollama / local models)

### Requirements

- Node.js 22.22.2+ on the Node 22 LTS line, or Node 24
- Optional: Ollama running locally for offline models

### Quick start

```bash
OPENUI_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 npm ci
npm run build
npm start
```

The OpenUI dependency's installer has pseudonymous telemetry enabled by default.
The install command above, CI and Docker disable it explicitly without skipping
lifecycle scripts or relaxing npm peer validation. These are installer controls,
not a claim that all third-party runtime behavior has been independently audited.

Open `http://localhost:3000` (or the port shown in the terminal). Development is also supported with `npm run dev -- --host localhost --port 5173`; the former StrictMode/composer subscription regression is covered by unit and dev E2E tests.

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
RATE_LIMIT_RPM=60                  # per API key or IP, sliding 1-minute window
# RATE_LIMIT_DISABLED=true         # skip rate limiting (dev only)
TRUSTED_PROXY_HOPS=0               # ignore untrusted forwarding headers

# Login with ChatGPT (Experimental BETA) — signs the session cookie and encrypts
# subscription tokens at rest. Required for stable sessions across restarts.
# LWC_SECRET=$(openssl rand -hex 32)
# LWC_SESSION_DAYS=180              # optional, accepted range: 1-365
# For Vercel/serverless, also connect an Upstash Redis integration and expose:
# UPSTASH_REDIS_REST_URL=https://<database>.upstash.io
# UPSTASH_REDIS_REST_TOKEN=...
```

**Rate limiting**

**Rate-limit deployment boundary:** With neither Upstash rate-limit variable set,
the limiter uses a bounded, process-local sliding window. This does not coordinate
multiple replicas or serverless instances. Set both `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` to share the window through an atomic Redis Lua script;
the same deployment variables already support session persistence. The limiter
does not use the session store's `KV_REST_API_*` aliases. It sends only SHA-256
identity fingerprints, request timestamps and random request IDs to Redis, never
provider keys or conversation text. Buckets expire after a minute of inactivity.
Shared-store errors, malformed replies or partial configuration reject requests
with HTTP 429 and a short retry interval rather than silently falling back to memory.

`TRUSTED_PROXY_HOPS` defaults to `0`. With no explicitly trusted proxy, non-keyed
requests share one unknown-client bucket because the Fetch request has no socket
peer address. `X-Real-IP` and `CF-Connecting-IP` are not trusted. Behind a controlled
reverse proxy that appends or overwrites `X-Forwarded-For`, set the exact number of
trusted hops (for example, `1` selects the rightmost address). Invalid or short
chains use the unknown bucket. **Block direct access to the Node server** and use
the same proxy path for every request; otherwise an attacker can spoof even the
configured hop. Keep upstream request-size/connection limits for public instances.

`npm run smoke:security` exercises the memory backend and the Upstash SDK against
an isolated loopback REST stub. This is not a live Redis/Lua certification. Run a
multi-replica concurrency check against your deployment's Redis before public exposure.

**Login with ChatGPT notes**

- Connect under **Settings → API Keys → ChatGPT**: a consent step opens an OpenAI device-code page; approval is detected automatically — no page reload — and the card then verifies the connection and lists the account's available models. A revoked or lapsed session shows **Reconnect** instead of failing silently, and a failed request offers to reconnect in place. If OpenAI rejects the code request, device-code sign-in may be off for the account — enable it in [ChatGPT security settings](https://chatgpt.com/#settings/Security).
- Tokens stay server-side (HttpOnly cookie). Local/single-node hosts persist sessions in `.data/` and generate a cookie secret at `.data/lwc-secret` so ChatGPT login survives `npm start` restarts. Sessions default to 180 days and renew while used; the app re-validates them in the background (on focus and periodically).
- Docker Compose mounts `.data/` in the named `ai-diy-data` volume, so rebuilding or replacing the container does not require another login.
- Multi-instance / serverless hosts must set a shared `LWC_SECRET` and a shared session store. Vercel uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present; the `KV_REST_API_URL` and `KV_REST_API_TOKEN` aliases are also accepted. The local `.data` files are not shared across replicas. If a serverless host lacks either, the connected ChatGPT card warns that sign-ins reset on restart (`/api/chatgpt/session` reports `persistence: "ephemeral"`). Token refreshes are serialized per session in-process (`app/lib/server/chatgpt-guard.ts`); OpenAI refresh failures are logged as `[chatgpt] OpenAI token endpoint answered <status> (<code>)` to show why a session ended.
- Without Redis credentials, serverless deployments fall back to process memory so login does not crash on the read-only filesystem, but sessions can reset on a cold start. Configure Redis for reliable ChatGPT login.
- This is a community SDK path, not an official OpenAI product. Users spend their own ChatGPT plan; disconnect via the widget or [ChatGPT security settings](https://chatgpt.com/#settings/Security).
- GPT Live WebRTC voice is **not** included in this BETA.

## Public deployment

1. Push this repo to any Node-capable host (VPS, Docker, PaaS).
2. **Do not** add LLM API keys to environment variables — users enter keys in the UI.
3. Build with `npm run build`, run with `npm start` (React Router Node SSR).
4. Ollama / localhost models **do not work** for remote users — the server cannot reach the user's machine. Use cloud providers or expose Ollama at a public HTTPS URL.
5. **Add rate limiting and request-size limits** before exposing a public instance. Treat shared demos as credential proxies in transit. Built-in server rate limiting uses `RATE_LIMIT_RPM` (default 60 requests/minute per API key or client IP); set `RATE_LIMIT_DISABLED=true` to disable during local development.

### Features on any host

| Feature                                               | Works                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Cloud providers (OpenAI, Anthropic, …)                | Works with user's BYOK key                                                              |
| Ollama / localhost custom proxy                       | Only when the server can reach them (same network / Docker)                             |
| Python `run_python` tool                              | Runs in each user's browser through Pyodide                                             |
| Web search, calculator, fetch URL, canvas             | Works                                                                                   |
| Chat history                                          | Stored in **user's browser** (IndexedDB)                                                |
| Client-side cloud backup (S3 / WebDAV / Google Drive) | Works in the browser; credentials never leave the client except to the storage endpoint |

### Cross-origin (separate frontend / API domains)

The app is same-origin by default: the browser calls `/api/*` on the same host that renders the UI, so no CORS setup is needed.

If you serve the frontend and API from different origins, set `CORS_ORIGINS` to the comma-separated list of allowed frontend origins. Requests from any other origin are rejected (wildcards are not supported):

```bash
CORS_ORIGINS=https://app.example.com,https://beta.example.com npm start
```

## Vercel Preview and public deployment

Temporary preview testing:

```bash
npx vercel
```

For the public launch, use `https://tryaidiy.com/` and set `VITE_SITE_URL` at build time so canonical URLs, sitemap entries, Open Graph metadata, and robots output use that domain. No persistent provider API keys are required in server environment variables.

## Vercel Connect (Optional, Beta)

App-scoped third-party integrations: protected MCP servers get `Authorization` bearer tokens automatically, and the `connect_request` tool can act on connected services (GitHub, Slack, SaaS…). Requires a Vercel account — Vercel remains the authorization hub and mints tokens. Feature is inert when nothing is configured.

**On Vercel:** nothing to set up. Each deployment receives `VERCEL_OIDC_TOKEN`; the SDK uses it automatically. Connectors must be linked to this project's environment (Vercel dashboard or `npx vercel connect create <provider>`).

**Local dev / self-hosted Node/Docker:** `vercel link` once (already done in this repo), then either

```bash
vercel env pull        # writes .env.local incl. a short-lived dev VERCEL_OIDC_TOKEN
# or, for long-running local instances, set a Vercel access token instead:
VERCEL_TOKEN=<access token for the team owning the connectors>
```

Declare connectors in `.env.local` or the shell:

```bash
CONNECT_CONNECTOR_GITHUB=scl_xxx          # connector id or UID
CONNECT_BASE_URL_GITHUB=https://api.github.com   # optional, for connect_request
CONNECT_SCOPES_GITHUB=repo                 # optional, space-separated app scopes
```

The bundled production server loads `.env` / `.env.local` automatically (`npm start`); dev mode does too via Vite. Real environment variables always win over `.env` / `.env.local`.

**Usage:** Settings → Connect Beta lists configured connectors; authorize each connector once as the operator (opens the consent URL), then `Test` to confirm token minting. MCP Beta → add a server with a "Vercel Connect connector" to have the app send its token as the Authorization header. The `connect_request` chat tool handles `list` / `inspect` / `authorize` / `call`.

Notes: app-subject tokens carry the operator-configured scopes (no per-user consent without an identity layer); keep scopes minimal. Connect access is per project + environment — replicate envs if you change hosts. Beta usage may be metered by Vercel; check your dashboard.

## Privacy

- API keys, chat history, Canvas artifacts, memory, knowledge-base chunks, and usage events stay in the **user's browser** (localStorage + IndexedDB).
- Keys are sent to **your** server only to proxy requests to the user's chosen provider — they are not stored server-side.
- Do not log request bodies or provider credentials in production.

## Security notes for public deployments

- `fetch_url` blocks private/local network URLs (SSRF guard).
- Provider roots, SearXNG, and remote MCP URLs reject private targets in production unless `ALLOW_PRIVATE_PROVIDER_URLS=true`.
- Stdio MCP is rejected server-side.
- Built-in server rate limiting uses `RATE_LIMIT_RPM` (default 60 requests/minute per API key or client IP); set `RATE_LIMIT_DISABLED=true` only for local development. Clients also support soft spend/token/RPM caps under Settings → Usage & cost.
- Users should treat shared public demos like any BYOK client: only use keys they trust the instance with.
