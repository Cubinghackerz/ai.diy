# Project guidance

## Stack and boundaries

- Product: ai.diy. PrismiumLite is legacy naming. Preserve `prismium-lite-db` (currently v14) and `prismium-lite:*` keys; do not rename, clear, or migrate storage without explicit approval.
- React Router 8 SSR, React 19, Vite 8, TypeScript, Tailwind 4, assistant-ui 0.15, Vercel AI SDK 7.
- Use Node 22.22.2+ on the Node 22 LTS line, or Node 24. Avoid unsupported odd Node releases.
- `~/*` aliases `app/*`. Browser-only helpers conventionally use `.client.ts`; server integrations belong in `app/lib/server/`. Browser APIs must be guarded during SSR.
- Provider credentials remain browser-owned and are relayed per request. Never log request bodies, keys, conversation data, or raw error payloads.
- Tool access must be enforced on both the client and server. Forwarded frontend tools must not have server executors or shadow server tools. OpenUI remains opt-in and lazy.
- Preserve the squared visual system and `.legacy-round` workspace exception. Do not redesign the original composer as part of reliability work.

## Debugging

Reproduce → localize → reduce → fix the root cause → add a failing regression test → verify. Preserve failure evidence. Do not disable StrictMode, ignore failing tests, clear browser storage, or weaken dependency/security controls to get a green result.

The former dev-composer regression is protected by a minimal StrictMode unit test and real dev E2E typing/send checks. Preserve the Vite optimizer entries for workspace/lazy modules: late discovery previously returned 504s and left cold-start hydration stuck on Loading. Dev E2E forces a cold optimizer cache and fails on stale dependencies or uncaught page errors. Update assistant-ui core/store/react/tap together; keep the AI SDK adapter/provider dependency graph compatible. The current OpenUI/Zustand override is scoped and intentional; strict `npm ci` must pass.

Render boundaries do not catch asynchronous storage failures. Use the persistence notice mechanism for background saves, retain unsaved data, and never overwrite unreadable encrypted settings. Backups and exports must include unsaved content when recovery depends on it.

## Verification

```bash
npm ci
npm run typecheck
npm run smoke
npm test
npm run lint:changed
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:e2e:dev
```

- `npm run dev -- --host localhost --port 5173` is the interactive dev path; `npm run build && npm start` serves production at localhost:3000.
- Unit tests live in `tests/unit/`, use Vitest/Testing Library, and load `fake-indexeddb`.
- E2E tests use isolated Chromium contexts and `scripts/mock-provider.mjs`; they need no credentials and start/stop their own servers. Ports 3000, 5173, and 18765 must be free. Private provider URLs are enabled only in the loopback test server environment, not through a product policy change.
- `lint:changed` checks touched source files against a Git baseline: legacy errors are counted, new hook/accessibility errors fail. `format:check` runs Prettier on touched supported files, excluding generated lockfiles. `CHECK_BASE=<commit>` checks committed changes.
- CI runs the complete smoke suite, units, build, production E2E, and focused dev composer tests. Do not describe real providers or untested UI flows as verified by a mock.
- No commits, pushes, live deployments, or destructive data operations without the user's request.
