# ai.diy quality roadmap

Owner plan received 2026-10-03. Status: Phase 1 in progress, not fully shipped.

## Contracts

- Preserve `prismium-lite-db` v14 and every existing `prismium-lite:*` key.
  No migration, renaming or storage clearing without explicit approval.
- Keys remain browser-owned and relayed per request. Never log keys, bodies,
  conversation contents or raw provider errors.
- Preserve tool gates on both sides, StrictMode, the optimizer entries, strict
  npm peer validation, the squared design and `.legacy-round` composer.
- No new providers/tools before Tier 1. No commits, pushes or deployments unless requested.
- Reproduce, localize, reduce, add a regression, fix, verify. Do not weaken gates.

## Phase 1: trust and safety

Implemented in this working tree:

1. Explicit `TRUSTED_PROXY_HOPS`, IP validation and safe unknown-client grouping;
   no trust in `X-Real-IP` or `CF-Connecting-IP`. Operators must prevent direct
   access around their trusted proxy.
2. Optional Upstash shared sliding window using the existing Redis dependency.
   Server-time pruning/count/admission run in one Lua evaluation; memory is used
   only when neither Redis variable is configured. Partial configuration, SDK
   failures and malformed replies reject instead of bypassing the shared limit.
   API callers await the decision. Backend smoke uses a REST stub, not live Redis.
3. Redacted chat/stream/media and document-render diagnostics, including an
   explicit AI SDK stream error callback and React Router error handler. Only
   allowlisted error kinds and bounded numeric HTTP status codes reach these logs.
   This is not a repo-wide certification of all integrations' logging.
4. OpenUI installation telemetry disabled explicitly for local verification,
   documented installs, CI and Docker. No lifecycle-script bypass or peer-validation relaxation.

Remaining, in the owner's Phase 1 scope:

- CSP report-only with per-request nonces and complete hydration/streaming coverage.
  Discovery found public pages prerendered in `react-router.config.ts`, with shared
  cache headers in `app/lib/http-headers.ts`. A runtime nonce alone does not protect
  static output: settle static hashes versus dynamic nonce delivery before claiming
  coverage. Preserve workspace COOP/COEP; allow the CheerpX script host on workspace
  only. Keep arbitrary HTTPS provider connections and loopback HTTP support.
  Enforce only after the full no-violation E2E gate passes.
- Self-host Hanken Grotesk and Fragment Mono; root currently also requests Bricolage
  Grotesque. Confirm actual use before removing any font, preserving the composer.
- Docker multi-stage/non-root/healthcheck and `.dockerignore` review. Docker is
  unavailable locally; no container-runtime verification is claimed.
- CI concurrency/caching/parallel jobs and initial non-blocking production audit report.
  Keep existing static, smoke, unit, build, production and dev regression checks.
- Opt-in local-only diagnostics ring buffer/export; no remote reporter authorized.
- Targeted dependency remediation: npm production audit on 2026-10-03 reports high
  findings for `@huggingface/transformers`, `onnxruntime-node`, `adm-zip`, `sharp`
  and `undici`. Check direct/transitive reachability and primary-source patched
  versions, preserve the matched assistant-ui/AI SDK graph, and verify each update.
  Do not run a blanket `npm audit fix --force` or claim the audit is clean.
- Verify the Lua window and concurrent replicas against an isolated real Redis;
  REST-stub success is not proof of live Redis execution.

The atomic script follows [Redis's Lua execution contract](https://redis.io/docs/latest/develop/programmability/eval-intro/)
and the existing SDK's [Upstash EVAL API](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval).

## Subsequent order: unchanged

1. Phase 6 mock-provider fidelity and isolated E2E: tool/reasoning streams, errors,
   slow/malformed streams, mobile/keyboard/a11y, then Firefox/WebKit smoke.
2. Phase 2 Tier 1: durable branching, search/palette, shortcuts, code blocks,
   sidebar decomposition then organization/virtualization. Additive branch fields
   are the preferred proposal, not approval for a storage migration. Stop before
   any necessary index/version change and request explicit migration approval.
3. Phase 3: explore before setup, retained drafts, guided/tested connections,
   honest sample/local demo and bounded tour. No hosted shared key.
4. Phase 4: measure bundles first, preserve optimizer entries, chunk/lazy load,
   streaming render profiling, budgets, app-shell-only PWA (never cache APIs).
5. Phase 5: separate design notes before request inspection, encrypted backups,
   compare, projects, exports or skill library. No unapproved external diagnostics.

The full owner's plan remains the source of truth for acceptance criteria.

## Verification

Use Node 22.22.2+ (22 LTS) or Node 24; the shell's Node 23 is unsupported.
Run installs with `OPENUI_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1`.

```bash
npm ci
npm run typecheck
npm run smoke
npm test
npm run lint:changed
npm run format:check
npm run build
npm run test:e2e
npm run test:e2e:dev
git diff --check
```

Use disposable Playwright contexts/mock credentials, never a personal workspace.
Keep ports 3000, 5173 and 18765 free. Coverage/result boundaries are in `QA.md`.
