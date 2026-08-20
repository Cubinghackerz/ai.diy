# ai.diy Feature QA Checklist

Pass/fail matrix derived from README “Available” features. Test from a **clean** browser profile (or cleared site data) after a fresh install.

**How to test:** Fresh install → configure → use → break intentionally → recover.

**Launch QA date:** 2026-08-18

**Local production build:** `npm run typecheck` pass, `npm run build` pass, `npm start` on `http://localhost:3000`

**Browsers:** Chrome (clean headless profile) pass for landing/setup; Safari WebDriver blocked (Remote Automation not enabled); Safari UA SSR 200

**390px:** Chrome landing and setup gate pass

**Provider key:** none available; Ollama not running. Live chat/Preview/tools blocked.

**Launch commit SHA:** see `git rev-parse origin/main` after this checklist is committed.

| # | Feature | Happy path | Break / recover | Status | Notes |
|---|---------|------------|-----------------|--------|-------|
| 1 | Landing page | `/` loads, CTAs work | Broken image / reduced motion | pass | Chrome clean profile: headline, CTAs, images, trust copy. Reduced motion emulated. |
| 2 | Chat | Send message, get reply | Abort mid-stream | blocked | No signed-in provider or API key. |
| 3 | Streaming | Tokens appear incrementally | Network drop mid-stream | blocked | Same. |
| 4 | Provider setup | Setup gate → save key | Invalid key → clear error | pass | Clean profile shows setup gate. Invalid key `not-a-key` shows format error. Happy-path save blocked (no live key). |
| 5 | Model discovery | Live list loads | Bad key / offline → fallback | blocked | Live list needs a valid key. |
| 6 | Model selection | Pick model, chat uses it | Unavailable model | blocked | Setup never unlocks models without a live key. |
| 7 | Multi-model Preview | 2–3 models + optional fusion | Missing key on one lane | blocked | Requires configured workspace. |
| 7a | Preview to regular chat | Select an existing chat or create New Chat from Preview; Preview exits and the correct thread loads | Preview run is active, interrupted, or restored | blocked | Same. |
| 7b | Preview lifecycle | Re-enter Preview, reload, retry a lane, remove a lane, and inspect per-run artifacts | No duplicate sends, orphaned streams, shared Canvas artifacts, or stale running state | blocked | Same. |
| 8 | Web search | Model uses search tool | Engine down / no results | blocked | Requires a live chat turn. |
| 9 | Search connectors | Test Tavily/Brave/Exa/Parallel | Bad connector key | blocked | No connector keys. |
| 10 | Remote MCP | Enable Firecrawl/Parallel MCP | Bad URL / stdio rejected | blocked | Settings UI not reachable before setup completes. |
| 11 | File uploads | PDF, image, text, CSV | Unsupported MIME removed | blocked | Composer not reachable before setup completes. |
| 12 | PDF / documents | Model reads attachment | Huge file / quota | blocked | Same. |
| 13 | Browser Python | `run_python` returns output | Syntax error recovery | blocked | Same. |
| 14 | Artifacts / Canvas | HTML/code/SVG open in canvas | Reopen from launcher | blocked | Same. |
| 15 | Local memory | Save entry; appears in prompt | Disable memory toggle | blocked | Same. |
| 16 | Image generation | Image model returns image | Bad key / unsupported | blocked | Same. |
| 17 | Voice dictation | Mic → transcript (Chromium) | Deny permission / Firefox hide | blocked | Requires workspace + mic. |
| 18 | Import | ChatGPT/Claude ZIP / Markdown | Corrupt file preview | blocked | Settings/data UI behind setup. `scripts/interop-smoke.mjs` currently fails to resolve importer module. |
| 19 | Export | Per-chat MD/JSON + ZIP all | Large history | blocked | No chat history in a clean profile. |
| 20 | Cloud backup | S3 / WebDAV / Drive backup+restore | Bad credentials | blocked | `scripts/s3-sign-smoke.mjs` pass (signing only). Live backup not run. |
| 21 | Settings | Persist across reload | Clear storage | blocked | Settings panel behind setup. |
| 22 | Themes | Light / dark / system | Flash on load | blocked | Theme controls behind setup. Onboarding remains forced dark. |
| 23 | Mobile UI | Workspace usable at 390px | Composer / sidebar | pass | Chrome 390×844: landing no overflow; setup field width 316px. Composer blocked (setup gate). |
| 24 | Error states | Invalid key / 429 / network | Message shows what/why/fix | pass | Invalid-key format error shown. 429 not exercised. |
| 25 | Loading states | Setup test, model list, chat | No blank hangs | pass | Setup gate loading → form; no blank hang on `/` or `/workspace`. |
| 26 | Skills (slash) | `/` forces Research etc. | Disabled skill | blocked | Composer behind setup. |
| 27 | Skill install | Browse catalog → Install | Uninstall | blocked | Same. |
| 28 | Agent Mode | Plan → skills/tools → verify | Tool failure recovery | blocked | Same. |

## Deploy from zero

| Path | Steps | Status | Notes |
|------|-------|--------|-------|
| Node | `npm i && npm run build && npm start` → localhost:3000 | pass | Typecheck + production build + `npm start`; public routes 200. |
| Docker Compose | `docker compose up --build` → :3000 | blocked | Docker CLI not available in this environment; compose file validated |
| Docker run | `docker build -t ai-diy . && docker run -p 3000:3000 ai-diy` | blocked | Same |
| Vercel preview | `npx vercel` (no `--prod`) → BYOK works | blocked | Vercel CLI not installed here. Live `https://tryaidiy.com/` currently serves the previous deploy (old trust copy). This commit must be pushed to refresh it. |

## Provider matrix (spot-check)

For each provider you care about: streaming, tool calls, vision (if claimed), long prompt, invalid key, 429, unavailable model.

| Provider | Stream | Tools | Vision | Bad key | Notes |
|----------|--------|-------|--------|---------|-------|
| OpenAI | blocked | blocked | blocked | pass | Format-invalid key rejected in setup. |
| Anthropic | blocked | blocked | blocked | blocked | No live key. |
| Gemini | blocked | blocked | blocked | blocked | No live key. |
| OpenRouter | blocked | blocked | blocked | blocked | No live key. |
| Ollama | blocked | blocked | blocked | blocked | Nothing listening on `:11434`. |
| Custom OpenAI-compatible | blocked | blocked | blocked | blocked | No endpoint. |

## First 5 minutes (cold)

- [x] Deploy or `npm start`
- [x] Open landing → Demo / Deploy / GitHub clear
- [x] Open workspace
- [ ] Configure API key
- [ ] Select model
- [ ] Start chatting
- [ ] Upload a file
- [ ] Use a tool (search or Python)
- [x] Understand data stays in the browser

## Security smoke

- [x] No API keys in server logs
- [x] No secrets in git
- [ ] `fetch_url` rejects localhost/private
- [ ] Stdio MCP rejected
- [x] CORS same-origin by default

Marked unchecked items were not runtime-exercised in this pass.

## Critical launch flow (requested)

| Step | Chrome | Safari | 390px |
|------|--------|--------|-------|
| Landing page | pass | blocked (Safari Remote Automation off; UA SSR 200) | pass |
| Workspace | pass (setup gate) | blocked | pass (setup gate) |
| Provider setup | pass | blocked | pass |
| Key verification | pass (invalid key only) | blocked | blocked |
| Model selection | blocked (no live key) | blocked | blocked |
| First chat | blocked | blocked | blocked |
| Stop/retry | blocked | blocked | blocked |
| File upload | blocked | blocked | blocked |
| Search/tool | blocked | blocked | blocked |
| Preview | blocked | blocked | blocked |
| Switch models | blocked | blocked | blocked |
| Reload/persistence | blocked | blocked | blocked |
| Export | blocked | blocked | blocked |

## Launch-copy verification (local production HTML)

- Headline unchanged: `Your AI workspace lives in your browser.`
- Hero shortened; no `17 providers`.
- RAG: `The index stays local, but retrieved context may be sent to the selected cloud model.`
- `Browser-owned by default.`
- TrustBoundary: `CHOSEN`, `RELAY · TRANSIT ONLY`
- Canonical / sitemap / robots / llms.txt / Privacy / Terms: `https://tryaidiy.com`
- OG image regenerated from `public/og-image.svg` (`20+ PROVIDERS`, 1200×630)

Mark **Status** as `pass`, `fail`, or `blocked`. File GitHub issues for every `fail`.

## Browser-Local NPM Project Smoke

| Check | Status | Notes |
|-------|--------|-------|
| Project-name and path traversal validation | pass | `npm run smoke:npm-project` |
| Registry-only package validation | pass | Rejects git, shell, file, and tarball specs; accepts scoped and exact-version packages. |
| Lifecycle-script protection | pass | Install plan always includes `--ignore-scripts`. |
| Bounded file writes | pass | 48 files max, 200 KiB per file, 1 MiB total. |
| Allowlisted npm scripts | pass | Only build/dev/start/preview/test/lint/typecheck/check/format. |
| WebContainer init/install/run/export flow | pass | Browser E2E covers init, write, registry install of `is-number@7.0.0`, npm run, inspect, read artifact, and tar export. |

## Tool Access & Token Budget

| Check | Status | Notes |
|-------|--------|-------|
| Setup/Settings capability allowlist | pass | `npm run smoke:tool-access` — disabled tools map to capability gates. |
| Historical tool-output projection | pass | `npm run smoke:token-efficiency` — recent turns stay intact; old tool dumps are bounded. |
| Bundled search MCP is deferred | pass | Parallel/Firecrawl load only on search intent or prior MCP use. |
