# ai.diy — Development handoff

## Product and stack

ai.diy is a local-first, BYOK chat workspace with 26 provider integrations. PrismiumLite is the legacy repository/storage name, not the product name.

- React Router 8 SSR, React 19, TypeScript, Vite 8, Tailwind 4.
- assistant-ui 0.15 and Vercel AI SDK 7; IndexedDB through `idb`.
- Use Node 22.22.2 or newer Node 22 LTS, or Node 24. The test dependencies do not support Node 23.
- `~/*` resolves to `app/*`. Browser-specific helpers use `.client.ts`; relay/provider code lives in `app/lib/server/`.
- `/` is the landing page; `/workspace` is the chat application.

## Run and verify

```bash
npm ci
npm run dev -- --host localhost --port 5173
```

The dev composer is supported again. The former input-reset bug was reproduced in an isolated assistant-ui harness: StrictMode caused store updates to stop reaching the controlled input. The matched core/store/react/tap patch set fixes the subscription lifecycle. Keep `tests/unit/composer.test.tsx` and dev E2E checks when updating these dependencies. Do not disable StrictMode or add a second draft state as a workaround.

A separate cold-start failure came from late Vite dependency discovery returning 504s for outdated optimized module URLs before hydration. `vite.config.ts` now scans the root, workspace routes, and lazy OpenUI registration up front. Dev E2E forces cache re-optimization with Vite’s `--force` and rejects stale-dependency responses/uncaught page errors; it must not rely on a warm cache.

```bash
npm run typecheck
npm run smoke
npm test
npm run lint:changed
npm run format:check
npm run build
npm run test:e2e
npm run test:e2e:dev
```

Playwright starts the production server at localhost:3000, or the dev server at localhost:5173 for `test:e2e:dev`, and a loopback-only mock OpenAI-compatible provider on port 18765. It seeds isolated browser contexts, needs no real key, and shuts its servers down automatically. Run `npx playwright install chromium` once locally. Do not point these tests at a running personal workspace.

CI runs typecheck, all 17 smoke scripts, unit tests, changed-file lint/format checks, build, production E2E, and focused dev composer tests. Existing hook/accessibility lint errors in touched legacy files are baselined; new errors fail. Formatting is checked on touched supported files, excluding the generated lockfile. Set `CHECK_BASE=<commit>` to check a committed change locally.

## Architecture and invariants

- `app/components/assistant-ui/AssistantRuntimeProvider.tsx`: AI SDK chat session, assistant-ui runtime, tool execution, transport, provider/model selection.
- `app/routes/api.chat.ts`: stateless model/tool relay; credentials arrive per request. Do not log bodies or keys.
- `app/components/assistant-ui/ChatThreadSync.tsx` and `app/lib/chat-store.ts`: history hydration, idle persistence, artifact extraction.
- `app/lib/db.ts`: database `prismium-lite-db`, version 14. Keep the name and `prismium-lite:*` settings keys unless an explicit migration is approved.
- `app/lib/tool-access.ts`: capability defaults and normalization. Enforce tool gates on both client and server.
- OpenUI is opt-in and lazy. Forwarded tools have bounded schemas and no server executors; they cannot shadow server tools. Supplemental instructions append to the base prompt.
- The scoped OpenUI/Zustand override is intentional. Plain `npm ci` must keep working; do not replace strict peer validation with `--legacy-peer-deps`.
- `SectionBoundary` isolates message, Canvas, Settings, and OpenUI rendering failures. Copied diagnostics intentionally omit raw error messages to protect conversation data and keys.
- `storage-notices.ts` exposes persistence failures through a banner and toast. Failed chat saves retain an exportable in-memory snapshot and offer retry. Artifact failures keep the Canvas copy; oversized artifacts explicitly prompt download.
- Auto-memory indexing (`indexChatMemories` in `ChatThreadSync.tsx`) is gated by `settings.memoryEnabled`; disabling memory stops new entries but never deletes stored ones.
- Rendered markdown is sanitized (`app/lib/markdown-sanitize.ts`): `rehype-raw` output passes a `rehype-sanitize` schema (scripts/iframes/styles/forms/event handlers stripped, `href` limited to http/https/mailto) before `rehype-katex`. Remote `http(s)` images render as click-to-load placeholders (`markdown-image.tsx`) so a model-emitted `<img src>` cannot leak conversation data to a remote host; `data:`/`blob:` sources render directly via `markdownUrlTransform`.
- `MessageUsageStats` is wired into the assistant message footer and shows provider/model, token totals, and catalog-derived cost when the metadata exists.
- Persistent storage is requested best-effort on first use. Import & Export shows site-wide usage/quota estimates and allows a manual persistence request. This is not a backup guarantee.
- The squared visual system is retained, with `.legacy-round` preserving the original chat/composer shape.

## Known gaps and next milestone

1. Branches are not durable: `replaceThreadMessages` still removes messages outside the active path. Tier 1 must coordinate transactional incremental persistence, stable timestamps/parents, active-leaf state, assistant-ui history restoration, and export. No schema migration is included in Tier 0.
2. A pre-existing version-17 database cannot be opened by version-14 code. Errors now surface instead of leaving an unexplained loading screen. Never clear user data as a fix; use a compatible build or explicit backup/recovery.
3. The send path is still behind setup. Explore-before-setup remains a later milestone.
4. Real-provider behavior, Safari, full mobile accessibility, Python/VM execution, and real OpenUI card/form interaction are not covered by the mock chat tests.
5. Search/palette, shortcut changes, richer code blocks, and sidebar organization remain Tier 1; no additional providers/tools should precede them.
6. Existing large modules and legacy accessibility findings remain. Do not mix their broad refactors into a focused bug fix.

See `AGENTS.md` for working rules, `QA.md` for coverage boundaries, and `README.md` for product/deployment facts. Commit or push only when requested.
