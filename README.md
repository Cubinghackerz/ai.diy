# ai.diy <sup>BETA</sup>

[![Clone repository](https://img.shields.io/badge/Clone-GitHub-181717?logo=github)](https://github.com/Cubinghackerz/ai.diy)
[![Deploy a preview](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCubinghackerz%2Fai.diy&project-name=ai-diy-preview)

> A local-first, bring-your-own-key AI chat for self-hosting on a standard Node.js server or Docker. The app does not require server-side LLM credentials.

ai.diy is built with React Router, assistant-ui, the Vercel AI SDK, Tailwind CSS, and browser-side Pyodide.

## Status

This is a beta project. Features described as **available** are wired into the application. Features marked **planned** are intentionally not presented as working integrations.

- Available: chat, provider setup, model discovery, local chat persistence, files, browser Python, search, connector-backed search, remote MCP, artifacts, local memory, voice dictation where the browser supports Web Speech, multi-model Preview, and import/export of chats (ChatGPT, Claude, ShareGPT, Markdown, ai.diy JSON).
- Coming soon: automatic Google Drive backup/restore, direct GitHub/Supabase/PostgreSQL/S3 adapters, encrypted browser-storage settings, in-app `ask_user` panels, and custom-provider capability probing.

## Quick Start

### Requirements

- Node.js 20 or newer
- npm
- An API key for a cloud provider, or a reachable Ollama/LM Studio instance

### Run locally

```bash
npm install
npm run build && npm start
```

Open `http://localhost:5173`, complete the setup gate, select a provider and model, then send a message.

`npm run dev` is not recommended: the Vite/React development runtime has a known composer input regression that does not affect the compiled production build. Use `npm run build && npm start` for local testing, or `PORT=5173 npm start` if you need the app on the same port.

### Production server

```bash
npm run build && npm start
```

This is the same compiled React Router SSR path used by a Vercel deployment and is the recommended way to test deployment behavior locally. It does not require Vercel, serverless functions, or Edge functions. The server listens on the port provided by the runtime; use `PORT=5173 npm start` when you want to use the same URL as the development server.

### Docker

```bash
docker build -t ai-diy .
docker run -p 3000:3000 ai-diy
```

For a container to reach Ollama on the host, use a host-reachable base URL such as `http://host.docker.internal:11434/v1` where supported by your Docker environment.

## What Runs Where

| Component | Location |
| --- | --- |
| Chat UI, settings, history, artifacts, memory, Preview sessions | Browser, using localStorage and IndexedDB |
| Dictation and Python execution | Browser, using Web Speech and Pyodide |
| LLM request relay, model discovery, web search, URL fetching, remote MCP | Node server |
| Provider API keys | Stored in the user's browser and sent with individual requests to the Node server for provider relay |

### BYOK Trust Boundary

No provider API key is configured in server environment variables or persisted by the application server. The selected key is included in each browser-to-server chat or discovery request so the server can call the selected provider. Treat a hosted ai.diy instance as a service that can observe keys in transit, and only use deployments you trust.

Settings, including provider keys, connector keys, and MCP headers, are persisted in browser localStorage. They are not encrypted at rest by the application today. Protect the browser profile and device, and do not use shared profiles for sensitive credentials.

## Available Features

### Providers and Models

The provider picker supports these built-in integrations:

| Provider | Default API root | Credential shape |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | API key |
| Anthropic | `https://api.anthropic.com` | API key |
| Google Gemini | `https://generativelanguage.googleapis.com` | API key |
| Groq | `https://api.groq.com/openai/v1` | API key |
| OpenRouter | `https://openrouter.ai/api/v1` | API key |
| xAI | `https://api.x.ai/v1` | API key |
| DeepSeek | `https://api.deepseek.com` | API key |
| Amazon Bedrock | Regional AWS endpoint | JSON credentials |
| Azure OpenAI | Configurable | JSON credentials |
| Google Vertex AI | Regional Google endpoint | JSON credentials |
| Vercel AI Gateway | `https://ai-gateway.vercel.sh/v4/ai` | API key |
| Together AI | `https://api.together.xyz/v1` | API key |
| Mistral | `https://api.mistral.ai/v1` | API key |
| Hugging Face | `https://router.huggingface.co/v1` | API key |
| Ollama | `http://localhost:11434/v1` | Optional placeholder key |
| LM Studio | `http://localhost:1234/v1` | Optional placeholder key |
| Custom OpenAI-compatible | Configurable | Optional API key |

The model picker requests a live model list where the provider exposes one. When discovery fails, it uses a small local fallback list so setup can continue. A live model list is discovery only: model capabilities are still inferred from app metadata and provider behavior, not verified with a per-model test suite.

### OpenAI-Compatible Endpoints

The **Custom OpenAI-compatible** provider is designed for OpenAI itself, gateways, proxies, Ollama, LM Studio, vLLM-style servers, and other compatible APIs without assuming every endpoint implements every OpenAI feature.

Current behavior:

- Enter an API root such as `https://provider.example.com/v1`.
- Trailing slashes are removed.
- Common endpoint suffixes are normalized to the API root: `/chat/completions`, `/responses`, `/models`, and `/embeddings`.
- The app deliberately does not append `/v1`; providers differ, so the value you enter remains authoritative.
- The app tries `GET /models` for discovery, but does not reject the setup when it fails. The fallback model can be selected instead.
- Auto-detect is the default transport mode and safely falls back to Chat Completions. The settings UI also supports explicit Chat Completions or Responses mode.
- Streaming, messages, tool definitions, temperature, top-p, and output-token limits flow through the Vercel AI SDK's OpenAI-compatible provider path.
- The Advanced section supports connection names, optional API keys, bearer/X-API-Key/custom-header/no-auth modes, custom headers, manual model IDs, timeout, retry limits, tool compatibility, and capability overrides.
- Test and Save are separate. Test reports model count, live/fallback discovery, latency, and the resolved API root. Save can use a manually entered model ID when `/models` is unavailable.

Still limited for custom endpoints:

- Automated per-model checks for streaming, tools, strict structured output, vision, embeddings, reasoning, or Responses API support.
- Pricing and context-window overrides.
- A custom endpoint proxy mode separate from the normal application relay.

Do not label a custom model as vision-, tool-, embedding-, or structured-output-capable solely because its provider markets it that way. Those capabilities need per-model verification, which is planned rather than implemented.

### Chat, Files, and Artifacts

- Streaming chat responses and provider reasoning when exposed by the selected model/SDK path.
- Reasoning-effort controls for supported models and providers.
- MIME-aware PDF, image, text, CSV, JSON, office-document, and source-file attachments. Unsupported files are removed with an explanation when the model changes.
- Image-generation model controls for supported providers and models.
- Canvas artifacts for generated HTML, code, SVG, Markdown, text, CSV, and JSON files.
- Generated artifacts persist by chat in IndexedDB and can be reopened from the artifact launcher.
- Automatic first-message title generation with a safe slug fallback.
- Light, dark, and system themes.

### Model Info Hover Cards

- Hovering any model in the chat header picker or the settings model selector shows a card with the model's description, capability badges (tools, vision, reasoning, structured output, image and video generation), context window, and estimated pricing.
- Descriptions, capabilities, context limits, and prices come from the open models.dev dataset, fetched at runtime and cached locally for 7 days, with a bundled snapshot of the built-in model catalog for offline use.
- Prices are estimates per 1M tokens from models.dev; exact billing depends on your provider.

### Model Icons

- Providers and models show brand-colored letter logos in the provider picker, model pickers (trigger and dropdown), hover cards, and the Usage & cost model rows.
- Logos are deterministic letter badges keyed by provider (OpenAI, Anthropic, Google/Gemini, Groq, DeepSeek, Bedrock, Azure, Vertex, OpenRouter/Gateway, Together, Mistral, Hugging Face, LM Studio, xAI, Ollama, custom) — no external logo requests, works offline.
- For gateway/Together/Hugging Face models the qualifier prefix (e.g. `openai/`, `google/`) selects the brand, so `google/veo-3.1` shows the Google mark.

### Video and Image Generation

- Image-generation models (DALL·E, GPT Image, Imagen, FLUX, Grok Imagine, …) are auto-detected — sending a message runs an image generation and the result renders inline with a download caption.
- Video-generation models (Veo 3.x, Kling, Seedance, Wan, Grok Imagine Video, …) are auto-detected from model id and the models.dev catalog; sending a message runs a video generation (supported on Gemini, Vertex, and Gateway providers) and the result renders as an inline playable video.
- A **Video** chip appears in the composer when a video model is selected; video models carry a video-camera badge in pickers and hover cards.
- Streaming responses that include audio/video/image file parts render inline rather than as raw download links.
- Generated videos are stored locally with the chat (browser IndexedDB); very large files may hit browser storage quotas.

### Local Usage and Cost Tracking

- Every provider response reports real token usage, which is captured on the assistant message and stored locally — nothing leaves the browser.
- Settings → **Usage & cost** shows real totals: input/output/reasoning tokens, estimated cost, breakdowns by model and provider, and the top chats by usage.
- Cost is estimated from models.dev pricing and labeled as such; chats from before this feature record no usage data.


### Tools

Tools available to a selected model depend on the settings toggles and provider support:

| Tool | Behavior |
| --- | --- |
| Web search | DuckDuckGo Instant Answer first-pass overviews, DuckDuckGo/Bing ranked-search fallbacks, self-hosted SearXNG, or one enabled Tavily, Brave, Exa, or Parallel search connector |
| URL fetch | Fetches public HTTP(S) pages/PDFs with private/localhost restrictions |
| Calculator | Evaluates bounded arithmetic expressions |
| Browser Python | Runs Pyodide in the browser and returns output to the model |
| Files | Creates downloadable artifacts through `generate_file` and Canvas files through `create_file` |
| Research skill | Plans subquestions, live multi-query search, source-quality grading, cross-verification, confidence labeling, and citation-backed synthesis before current-information queries |
| Skills | Generates reusable `SKILL.md` documents and frontend design briefs; the Word Document skill creates beautifully designed `.docx` reports, proposals, resumes, and briefs via python-docx |
| Local time | Returns an ISO timestamp for an IANA timezone |
| Memory | Bounded local memory is automatically attached to provider system instructions when entries exist; optional retrieval stays in the browser |
| Ask user | Uses the browser's native prompt while an in-app panel is planned |
| MCP | Loads tools from enabled remote HTTP or SSE MCP servers per chat request |

DuckDuckGo Instant Answers are enabled by default with Web Search for fast definitions, entity lookups, and broad overviews. They are a discovery layer, not an LLM or a substitute for fetching authoritative sources. The free DuckDuckGo Instant Answer service is intended for non-commercial use; review DuckDuckGo's current terms before commercial deployment.

Pyodide loads in the browser on first use. NumPy, pandas, Matplotlib, SciPy, SymPy, scikit-learn, Pillow, NetworkX, BeautifulSoup, lxml, regex, dateutil, and PyYAML can be loaded on demand. A local server-side Python installation is not required.

### Voice Dictation

The composer displays Voice input only when the browser exposes the Web Speech Recognition API. It uses the device's microphone permission and the browser/provider speech service; audio is not sent to ai.diy's Node server by the dictation adapter.

- Supported browser families generally include current Chrome, Edge, and Safari versions with speech recognition enabled.
- Firefox commonly does not expose the required API, so the voice control is hidden there.
- Use HTTPS in deployed environments because browsers generally require a secure context for microphone access. `localhost` is treated as secure by most browsers.
- Dictation uses interim transcripts, preserves existing composer text, restarts after recoverable silence/network ends, and stops cleanly when the stop button is pressed.
- Browser recognition quality depends on microphone quality, selected language, ambient noise, the browser's speech service, and the provider's availability. Review transcripts before sending.

### Local Memory and Backup

Chats, messages, artifacts, saved memory entries, and Preview sessions live in browser IndexedDB. The newest bounded historical memories are selected locally and automatically attached to provider system instructions, so provider tool-calling behavior is not required for memory to work. Saved memory is separate from active app preferences and the full archive is never injected automatically; the optional memory tool is available only when entries exist.

Settings -> Memory (Beta) can import supported text/JSON memory exports and export the memory index. Settings -> Cloud storage (Beta, coming soon) can download a complete local JSON backup containing chats, artifacts, Preview sessions, and memories. This is a manual backup file today; automatic cloud upload and restore are not implemented.

### Import & Export

Chats are never locked in. Settings -> Import & Export (or hover a chat in the sidebar and use the download icon) provides:

- **Export per chat**: Markdown (`.md`, frontmatter with title/model/provider, `## User` / `## Assistant` sections) or ai.diy JSON (lossless message content, timestamps, tool calls, and results).
- **Export everything**: a ZIP bundle of one Markdown file per chat, plus the existing full JSON backup download in Cloud Storage.
- **Import**: ChatGPT account export ZIP (`conversations.json`), Claude account export ZIP (`conversations.json`), ai.diy backup or per-chat JSON, ShareGPT/OpenAI JSONL chat files, and Markdown chat files. Format detection is automatic (ZIP/JSON/JSONL/Markdown), with a preview showing the detected source, chat/message counts, and any skipped content before importing.
- Imports always create new chats with fresh ids; existing chats are never modified. Everything runs locally in the browser — files are never uploaded.

### Multi-Model Preview

Settings -> Experimental enables a workspace that runs one to three model configurations in parallel. After primary runs finish, an optional fusion model can synthesize their outputs. Preview tabs retain their own messages, artifacts, tool calls, and upload compatibility handling in IndexedDB.

## Integrations

### Search Connectors

Tavily, Brave Search, Exa, and Parallel have direct BYOK search adapters. In Settings -> Connectors Beta:

1. Paste the connector key.
2. Select **Test** to send a bounded search request.
3. A successful test enables that connector.
4. Select it as the active web-search engine in Settings -> Tools.

Only one direct search connector is active at a time. Connector keys are stored in browser localStorage and relayed only for the current server request.

GitHub, Supabase, PostgreSQL, and S3 do not have direct adapters. Use an appropriately permission-scoped Remote MCP server for those integrations. Do not place database superuser/service-role credentials in this app.

### Remote MCP

Settings -> MCP Beta supports remote Streamable HTTP and SSE MCP servers.

1. Enter a server name and URL.
2. Choose the exact transport instead of relying on URL guessing.
3. Optionally provide a JSON object of HTTP headers, for example `{"Authorization":"Bearer token"}`.
4. Enable the server. Its discovered tools are namespaced before being passed to the selected model.

Two free hosted web-search MCP servers are bundled by default and enabled on first run: Parallel Search MCP (`https://search.parallel.ai/mcp`, tools `web_search`/`web_fetch`) and Firecrawl Keyless (`https://mcp.firecrawl.dev/v2/mcp`, tools `firecrawl_search`/`firecrawl_scrape`/`firecrawl_parse`). No API keys are required; the model is instructed to prefer these over the built-in DuckDuckGo search. Existing installations can add them with one click from the MCP Beta panel.

Remote MCP servers are contacted by the Node server for each chat request and are closed when that response finishes. Redirects are rejected. Browser-controlled Stdio MCP execution is disabled because it would permit arbitrary host command execution. MCP OAuth authorization flows and connection pooling are not implemented.

### Cloud Storage

The Cloud storage section is Beta and marked coming soon. It currently provides a downloadable local recovery file only. Google Drive OAuth with PKCE, `drive.appdata` upload, restore, and conflict handling are planned. No Drive token, refresh token, or automatic cloud sync is collected by the current UI.

## Security and Network Controls

- LLM API keys are not stored by the Node server, but are proxied in transit for each provider request.
- `fetch_url` rejects local, private IPv4, metadata, and `.local` targets.
- User-configured provider roots, SearXNG URLs, and remote MCP URLs require HTTP(S), reject credentials embedded in URLs, and reject private/network-local targets in production by default.
- Set `ALLOW_PRIVATE_PROVIDER_URLS=true` only on a trusted self-hosted deployment when you intentionally need Ollama, LM Studio, a private SearXNG instance, or private remote MCP targets in production.
- Remote MCP request headers reject invalid header names and newline injection; nevertheless, treat their contents as secrets because they remain in browser localStorage.
- Remote MCP redirects are rejected.
- Stdio MCP configurations are rejected server-side.
- Add application-level rate limiting and request-size limits before exposing a public instance.
- Do not log request bodies or provider credentials in production infrastructure.

## Environment Variables

No LLM provider key is required in the server environment. Optional configuration:

```bash
# Extra browser origins allowed to call /api/*. Same-origin needs no setting.
CORS_ORIGINS=https://app.example.com,https://beta.example.com

# Trusted self-hosted deployments only. Allows private/localhost configured URLs in production.
ALLOW_PRIVATE_PROVIDER_URLS=true

NODE_ENV=production
```

`CORS_ORIGINS` does not accept wildcards. Keep the browser and API same-origin unless there is a specific need to separate them.

## HTTP API

These routes are application-internal and expect the settings data supplied by the browser:

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/chat` | `POST` | Streams a provider response, tools, images, and enabled remote MCP tools |
| `/api/models` | `POST` | Attempts model discovery for a selected provider/root/key |
| `/api/title` | `POST` | Generates a short thread title |
| `/api/search` | `POST` | Performs DuckDuckGo/Bing fallback or SearXNG retrieval |
| `/api/connectors` | `POST` | Tests one direct search connector with a bounded query |

Do not expose these endpoints as a multi-tenant credential proxy without authentication, rate limits, usage controls, and independent security review.

## Deployment

Self-hosting with Node or Docker is the default deployment model. See [DEPLOYMENT.md](./DEPLOYMENT.md) for operational notes, CORS setup, and local-model networking constraints.

### Vercel Preview Only

This repository's Vercel usage is for temporary Preview testing, not a production dependency. Deploy a non-`main` branch without `--prod`:

```bash
npx vercel
```

Do not attach a production domain or use `npx vercel --prod` for this beta workspace.

## Development

```bash
npm run dev        # Development server at http://localhost:5173
npm run build      # Compile the production React Router SSR build
npm start          # Serve build/server/index.js
PORT=5173 npm start # Serve the production build at http://localhost:5173
npm run typecheck  # React Router type generation then TypeScript
```

`npm run dev` uses Vite's React development runtime and HMR. It is not the same runtime as a Vercel deployment. Use `npm run build && npm start` when validating the production behavior locally.

The generated React Router type files can report path-resolution diagnostics in some local environments. Run `npm run build` as the release gate and investigate any source-file diagnostics independently.

## License

MIT. See [LICENSE](./LICENSE).
