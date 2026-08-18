# ai.diy Feature QA Checklist

Pass/fail matrix derived from README “Available” features. Test from a **clean** browser profile (or cleared site data) after a fresh install.

**How to test:** Fresh install → configure → use → break intentionally → recover.

| # | Feature | Happy path | Break / recover | Status | Notes |
|---|---------|------------|-----------------|--------|-------|
| 1 | Landing page | `/` loads, CTAs work | Broken image / reduced motion | | |
| 2 | Chat | Send message, get reply | Abort mid-stream | | |
| 3 | Streaming | Tokens appear incrementally | Network drop mid-stream | | |
| 4 | Provider setup | Setup gate → save key | Invalid key → clear error | | |
| 5 | Model discovery | Live list loads | Bad key / offline → fallback | | |
| 6 | Model selection | Pick model, chat uses it | Unavailable model | | |
| 7 | Multi-model Preview | 2–3 models + optional fusion | Missing key on one lane | | |
| 7a | Preview to regular chat | Select an existing chat or create New Chat from Preview; Preview exits and the correct thread loads | Preview run is active, interrupted, or restored | | |
| 7b | Preview lifecycle | Re-enter Preview, reload, retry a lane, remove a lane, and inspect per-run artifacts | No duplicate sends, orphaned streams, shared Canvas artifacts, or stale running state | | |
| 8 | Web search | Model uses search tool | Engine down / no results | | |
| 9 | Search connectors | Test Tavily/Brave/Exa/Parallel | Bad connector key | | |
| 10 | Remote MCP | Enable Firecrawl/Parallel MCP | Bad URL / stdio rejected | | |
| 11 | File uploads | PDF, image, text, CSV | Unsupported MIME removed | | |
| 12 | PDF / documents | Model reads attachment | Huge file / quota | | |
| 13 | Browser Python | `run_python` returns output | Syntax error recovery | | |
| 14 | Artifacts / Canvas | HTML/code/SVG open in canvas | Reopen from launcher | | |
| 15 | Local memory | Save entry; appears in prompt | Disable memory toggle | | |
| 16 | Image generation | Image model returns image | Bad key / unsupported | | |
| 17 | Voice dictation | Mic → transcript (Chromium) | Deny permission / Firefox hide | | |
| 18 | Import | ChatGPT/Claude ZIP / Markdown | Corrupt file preview | | |
| 19 | Export | Per-chat MD/JSON + ZIP all | Large history | | |
| 20 | Cloud backup | S3 / WebDAV / Drive backup+restore | Bad credentials | | |
| 21 | Settings | Persist across reload | Clear storage | | |
| 22 | Themes | Light / dark / system | Flash on load | | |
| 23 | Mobile UI | Workspace usable at 390px | Composer / sidebar | | |
| 24 | Error states | Invalid key / 429 / network | Message shows what/why/fix | | |
| 25 | Loading states | Setup test, model list, chat | No blank hangs | | |
| 26 | Skills (slash) | `/` forces Research etc. | Disabled skill | | |
| 27 | Skill install | Browse catalog → Install | Uninstall | | |
| 28 | Agent Mode | Plan → skills/tools → verify | Tool failure recovery | | |

## Deploy from zero

| Path | Steps | Status | Notes |
|------|-------|--------|-------|
| Node | `npm i && npm run build && npm start` → localhost:3000 | | |
| Docker Compose | `docker compose up --build` → :3000 | blocked | Docker CLI not available in this environment; compose file validated |
| Docker run | `docker build -t ai-diy . && docker run -p 3000:3000 ai-diy` | blocked | Same |
| Vercel preview | `npx vercel` (no `--prod`) → BYOK works | | Manual |

## Provider matrix (spot-check)

For each provider you care about: streaming, tool calls, vision (if claimed), long prompt, invalid key, 429, unavailable model.

| Provider | Stream | Tools | Vision | Bad key | Notes |
|----------|--------|-------|--------|---------|-------|
| OpenAI | | | | | |
| Anthropic | | | | | |
| Gemini | | | | | |
| OpenRouter | | | | | |
| Ollama | | | | | |
| Custom OpenAI-compatible | | | | | |

## First 5 minutes (cold)

- [ ] Deploy or `npm start`
- [ ] Open landing → Demo / Deploy / GitHub clear
- [ ] Open workspace
- [ ] Configure API key
- [ ] Select model
- [ ] Start chatting
- [ ] Upload a file
- [ ] Use a tool (search or Python)
- [ ] Understand data stays in the browser

## Security smoke

- [ ] No API keys in server logs
- [ ] No secrets in git
- [ ] `fetch_url` rejects localhost/private
- [ ] Stdio MCP rejected
- [ ] CORS same-origin by default

Mark **Status** as `pass`, `fail`, or `blocked`. File GitHub issues for every `fail`.
