# Prompt: finish the ai.diy landing page ("pinnacle" pass 2)

Paste everything below the line into a fresh agent session (Claude Code or Codex) opened in
`/Users/nirneet/Documents/GitHub/PrismiumLite`. It is self-contained.

---

You are finishing a landing-page upgrade for **ai.diy** (repo: PrismiumLite, legacy name). Read `AGENTS.md`, `DESIGN.md` and `PRODUCT.md` first; they are authoritative. Pass 1 is already done and verified (see "State"). Your job is pass 2: the high-value pieces that were deliberately skipped.

## Hard rules (violating any of these is a failure)

- **No commits, pushes, deploys, or destructive data operations** unless the user asks.
- Do **not** touch `components.json`, workspace routes (`app/routes/home.tsx`), `app/lib/db.ts`, the composer, or storage. Preserve `prismium-lite-db` v14 and `prismium-lite:*` keys. Never print those legacy names on the landing page; say "IndexedDB" / "localStorage".
- Design system is fixed: `#000` canvas, `#0a0a0a`/`#111` surfaces, `white/[0.08–0.1]` hairlines, flat mint `#3DFFB0` live signal, Geist Sans/Mono, Phosphor Light icons (landing route only), solid white CTAs, **square corners 1–6px**, **no gradients**, no dot fields, no nested bezels. Keep the cipher headline (`CipherHeadline.tsx`) as the one focal motion moment.
- **No fabricated content**: no invented metrics, customers, testimonials, package names, or screenshots of fake model output. Use real GitHub stars, real commands, facts that appear in `README.md`.
- Honor `prefers-reduced-motion` everywhere; reduced-motion users get visible static final states. Interactive targets >= 40px, visible focus rings, WCAG AA contrast (small text no dimmer than `zinc-500` on black).
- Landing is **prerendered**: new code must be hydration-safe and SSR-guarded (`.client.ts` helpers for browser-only code). No inline scripts or `eval` (CSP work is in flight). No new third-party hosts.
- Do not weaken StrictMode, tests, lint, dependency/security controls. Do not run `npm audit fix --force`. Do not clear browser storage.
- Active shell Node is v23.11.0 (odd release; AGENTS.md prefers 22.22.2+ or 24). Do not change it; note engine warnings, don't "fix" them.

## State (pass 1, already in the working tree, uncommitted)

Done: landing tokens in `app/styles/app.css` now match DESIGN.md (`#000`/`#0a0a0a`); hero sub copy shortened and a copyable `git clone github.com/Cubinghackerz/ai.diy` chip added (`app/components/landing/Hero.tsx`); hero screenshot `fetchPriority="high"` (`ProductBezel.tsx`); Ownership callout cards removed (`OwnershipStage.tsx`); Composio logo wall cut 47 -> 12 (`ComposioApps.tsx`); Capabilities "Deploy" tab removed (`CapabilityRack.tsx`); changelog hides maintenance commits (`hooks.ts`, `isVisitorFacing`); `zinc-600` -> `zinc-500` in landing components; DESIGN.md composition list updated. typecheck, `lint:changed`, `format:check`, `build` passed. Unit/smoke/E2E suites were NOT run.

Tooling: `.mcp.json` (local only, excluded via `.git/info/exclude`; do not commit) defines three servers: `shadcn` (`npx shadcn@latest mcp`), `flowbite` (`npx -y flowbite-mcp`, no Figma token), `arc` (HTTP, `https://uiarc.dev/api/mcp`). They load only after a Claude Code restart; verify with `/mcp` that all three show Connected. If a server is not connected, continue without it and say so. Do not invent substitutes. daisyUI is not used; skip it.

Known pre-existing defects found (fix in this pass, they are cheap):

1. **Hero steps can stay at `opacity: 0`.** In `app/components/landing/LandingShell.tsx` the 1200 ms failsafe is cancelled as soon as `initLandingAnimations` resolves, but `app/lib/landing-animations.client.ts` only starts a GSAP tween afterwards. If the ticker stalls (observed in an emulated 375px tab, both locally and on production), content stays invisible. Fix: keep the failsafe armed until the tween's `onComplete`, or reveal immediately when the tween cannot run. Add a regression E2E.
2. **7px horizontal overflow at 375px**: the off-canvas mobile menu panel in `app/components/landing/IslandNav.tsx` (`px-8 pt-16`, right edge at 382px). Make it not contribute to scroll width (e.g. `inert`/`visibility:hidden` + `overflow-x: clip` on the landing shell, or transform it fully off-canvas).

## Work to do, in this order

### 0. Tooling check (small)

- Confirm MCP servers are connected. Use `shadcn` to list registries, and `arc` (`search_components`, `get_component`, `get_install_command`, `get_skill`) and `flowbite` (component docs) **as references only**. Reuse what exists in `app/components/ui/` first. Any component you pull must be re-tokened to the squared blackfield system (no new radii, no gradients, no Flowbite/Arc default look, no Flowbite plugin/JS). Pull a component only if it removes more code than it adds. `shadcn add` is allowed only for items you actually use (candidates: `command` + `dialog` for the palette). Note: shadcn style is `base-nova` (Base UI primitives).
- Arc requires browser sign-in on first connect and a free account; if auth is needed, stop and ask the user rather than working around it.

### 1. Single source for counts

- Find the real provider-integration count in code (see `app/lib/providers*`, `app/lib/setup.ts`, `app/lib/subscription-providers.ts`). `PRODUCT.md` says 26; the landing says "20+". Create one constant (e.g. in `app/components/landing/constants.ts`) and use it in Hero/FactsBand/Ownership/Providers/FAQ and the JSON-LD `featureList` in `app/routes/landing.tsx`. State only what the code supports; "20+" is acceptable if the count is >= 20 and you cannot verify more.

### 2. "Inspect it": interactive Local Data Plane (the centerpiece)

Replace the static `TrustBoundary.tsx` usage in `OwnershipStage.tsx` with an interactive, keyboard-operable component (e.g. `InspectDataPlane.tsx`):

- Three nodes: **Your browser** (OWNED), **Node relay** (TRANSIT), **Chosen provider** (CHOSEN). Each is a focusable control; hover/focus/click reveals what lives there, using **only** facts from `README.md` (browser: keys in localStorage encrypted when Web Crypto + IndexedDB are available, threads/Canvas/memory/knowledge/usage in IndexedDB; relay: no persistent provider keys, per-request forward, private-network URL rejection, redirects rejected, optional rate limits; provider: cloud or local endpoint you choose, retrieved context may be sent to the selected cloud model).
- A **"Follow one request"** control steps the single mint packet through four labelled stages: key read from browser -> relayed per request -> provider response streamed -> saved to IndexedDB. Announce the current stage via `aria-live="polite"`.
- No JS / reduced motion / SSR: render all four stages statically as a numbered list. Roles, names and a visible focus ring required. Reuse `SectionLabel`, `MaskedHeading`, `Reveal`, `EASE_OUT`, existing mint token. One packet only; no other loops.
- Remove duplicated ownership copy elsewhere where it just repeats this section (Capabilities "Storage" lane body, FAQ answers) but keep `FAQ_ITEMS` as the JSON-LD source and keep its answers truthful.

### 3. "In use" section (replaces `UseCases.tsx` cards)

- The only existing UI image (`public/workspace-demo.png`) is an almost empty composer, so cropping it is useless. Produce real captures instead:
    - Preferred: run the app (`npm run build && npm start`) with Playwright + `scripts/mock-provider.mjs` (no credentials) and capture real UI chrome for: a Canvas artifact panel, browser-Python output (chart/CSV file chip), and Settings -> Knowledge Base. Do not show provider branding or invented model prose as if it were a real provider's output. Label any mock-derived capture honestly in the caption and alt text ("UI capture, mock provider").
    - If a capture is not credibly honest, fall back to typographic evidence (mono spec rows with real capabilities from README) and tell the user.
- Export WebP/AVIF with explicit `width`/`height` into `public/landing/`; `loading="lazy"` below the fold. Keep the "Explore the product" `SEO_GUIDES` link list (internal linking).
- Add Canvas and Python lanes to `CapabilityRack.tsx` so lanes match this section.

### 4. Nav: stars and jump palette

- `useGithubStars` already exists in `app/components/landing/hooks.ts`; surface the real star count in `IslandNav` (hide it silently if the fetch fails; never show a fake number).
- Add a `⌘K` / `Ctrl+K` jump palette (section links + Open workspace + GitHub). Use shadcn `command` + `dialog` re-tokened square, or a small local component if that is less code. Esc closes, focus is trapped and restored, labelled for screen readers. Do not collide with the workspace hotkeys (those are on `/workspace` only).

### 5. First paint and LCP

- Ship the hero screenshot as AVIF/WebP via `<picture>` with the PNG fallback (`workspace-demo.png` is 1280x800; keep dimensions to prevent CLS). Update the `preload` link in `app/routes/landing.tsx` to the format actually used.
- Normalize section padding to one scale (target `py-20 sm:py-28`) across landing sections.
- Target on a production build, mobile profile: LCP < 2.0 s, CLS ~ 0. Record real numbers; if a target is missed, report the real value and why.

### 6. Scroll-pinned product story (optional, only if 1-5 are green and cheap)

Sticky product window with three swapping captions (add a key -> switch model mid-thread -> ship an artifact). Use the existing GSAP/`motion` stack; no new animation library; stacked static fallback for reduced motion and < md. **Drop it if it regresses LCP, CLS, hydration, or mobile.** Say so plainly if dropped.

### 7. Docs

Update `DESIGN.md` (composition, motion budget: one packet, one headline decrypt, optional one pinned scene) and `PRODUCT.md` brand line only where facts changed. Keep them truthful.

## Verification (run all; report failures with their real output, never work around them)

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

Ports 3000, 5173 and 18765 must be free. `npm ci` must pass strict peer validation; do not add overrides. Add Playwright/Vitest coverage in `tests/` for: hero steps never stuck at opacity 0 (including reduced motion and a stalled animation); no horizontal overflow at 375px; Inspect-it keyboard operation + static fallback; palette open/close/focus-restore; no uncaught page errors; JSON-LD parses and FAQ JSON-LD matches the rendered FAQ.
Manual (built-in browser, `npm run build && npm start` at `http://localhost:3000/`): 375 / 768 / 1440 px screenshots, keyboard-only pass through nav -> hero -> Inspect-it -> capability tabs -> FAQ, reduced-motion emulation, dev server console clean of hydration warnings (`npm run dev -- --host localhost --port 5173`). Lighthouse mobile on the production build (targets: Performance >= 95, Accessibility >= 98, SEO 100) with actual numbers recorded.
Do not describe real providers or untested UI as verified by the mock. Stop any server you started.

## Final report format

Short. List: what changed (files), what was verified (with commands and real results), what was not run or not achieved, any dropped item (e.g. scroll story) and why, and decisions needing the user. Remind the user that `package.json`/`package-lock.json` already had uncommitted changes and that `.mcp.json` is local-only.
