# Plan: In-app ask_user panel, chat search, custom-provider capability probing

## Constraints

- Work on branch `feat/subagents` (already checked out). Do **not** create a new branch; do **not** clear, reset, or stash the working tree. The tree currently has uncommitted in-flight subagents refactor changes (`app/components/assistant-ui/subagents.tsx`, `app/components/assistant-ui/Thread.tsx`, `app/lib/server/chat-tools.ts`).
- Do not commit unless the user explicitly asks.
- Precondition: run `npm run typecheck` first to confirm the in-flight subagent refactor compiles. If it fails, fix the refactor minimally before starting feature work.

## Feature 1 — In-app `ask_user` panel (popup cards)

Replace the native `window.prompt()` in `app/lib/client-tools.ts:11` with in-app popup cards, styled after the subagent popup (`SubagentPopup` in `app/components/assistant-ui/subagents.tsx:205` — fixed bottom-right stacked cards).

### Steps

1. New file `app/components/assistant-ui/ask-user.tsx`:
   - Types: `AskUserQuestion = { id: string; question: string; questionType: "single" | "multiple" | "short"; options?: string[]; status: "pending" | "answered" | "skipped" }`.
   - `AskUserContext` value: `{ questions; ask(q): Promise<string>; answer(id, value): void; skip(id): void }`.
   - `ask()` registers a resolver in a `useRef` Map (same pattern as `SubagentProvider.runSubagent`, `subagents.tsx:96-108`), appends a `pending` question, returns the promise.
   - `answer(id, value)` / `skip(id)` resolve the promise (skip → `"The user skipped this question."`), mark status, and remove the card after a short delay.
   - `AskUserProvider` renders children plus `<AskUserPopup />` (fixed `bottom-4 right-4 z-50` stack, cards matching subagent card styling: `rounded-xl border bg-background shadow-lg`).
   - Card contents per type: `single` → radio list; `multiple` → checkboxes (answer joined `", "`); `short` → auto-focus textarea. Buttons: Answer (primary), Skip (outline). Escape skips; Enter submits short-answer.
2. Delete `askUserInBrowser` from `app/lib/client-tools.ts` (only importers: `AssistantRuntimeProvider.tsx:31` and `PreviewWorkspace.tsx:36`).
3. `app/components/assistant-ui/AssistantRuntimeProvider.tsx`: replace `askUserInBrowser` call in the `onToolCall` `ask_user` branch (~line 170) with `useAskUser().ask(...)` hook. The `pendingClientCalls` / `sendAutomaticallyWhen` flow (lines 159, 247-254) stays unchanged because the promise resolves only after the user answers.
4. `app/components/assistant-ui/PreviewWorkspace.tsx` (~line 1006): same replacement in its `onToolCall` `ask_user` branch.
5. `app/routes/home.tsx`: mount `<AskUserProvider>` around **both** preview and non-preview paths — cleanest at the top level: `<CanvasProvider><AskUserProvider><HomeInner /></AskUserProvider><ArtifactLauncher /></CanvasProvider>`. `SubagentProvider` (line 245) stays where it is. Subagent `ask_user` behavior is unchanged (subagents.tsx:474 already resolves with "Subagents cannot ask the user questions.").
6. README.md: update the Tools table row (`Ask user | ... while an in-app panel is planned` → in-app panel) and remove "in-app `ask_user` panels" from the Coming soon list (README.md:15).

### Edge cases

- Multiple concurrent questions stack as separate cards (preview workspace panes, parallel tool calls).
- Thread switch mid-question: popup is app-level, promise stays pending until answered — acceptable; no resolver cleanup needed beyond the Map.
- Empty `options` with `single`/`multiple` → render free text instead of a broken option list.

## Feature 2 — Chat search across messages (sidebar)

Full-text search over IndexedDB messages, surfaced in the sidebar chat panel.

### Steps

1. `app/lib/db.ts`: add `searchThreadsAndMessages(query: string, opts?: { maxPerThread?: number; maxResults?: number }): Promise<Array<{ thread: ThreadData; snippet: string; matchedIn: "title" | "message" }>>`.
   - Cursor-scan the `messages` store (via `getDB()`), case-insensitive `content.toLowerCase().includes(q)`; also match thread titles.
   - Bound: default `maxPerThread: 3`, `maxResults: 40`; sort results by thread `updatedAt` desc.
   - Skip `role: "tool"` messages.
2. `app/components/sidebar/AppSidebar.tsx` `ChatsPanel` (the component containing the Projects/Chats lists, ~lines 405-726):
   - Add a search `Input` below the New Thread / Memory row (line 447).
   - Local state `searchQuery`, debounced ~200ms; when non-empty, render a results list instead of the Projects + Chats sections: thread title, one-line snippet with `<mark>` highlight of the match, click → `onSelectThread(thread.id)`.
   - Highlight helper: escape the query, split snippet (~90 chars around first match) on the regex, wrap matches in `<mark>`.
   - Empty state: "No matches." Escape clears the query.
3. README.md: add a bullet under Chat/Files/Artifacts (or a new "Search" line) noting sidebar search covers persisted chat messages and titles.

### Edge cases

- Very large message stores: cursor scan is bounded by result caps; acceptable for local-first app.
- Artifacts and memory entries are out of scope (title + message content only).
- Newly typed messages persist via `ChatThreadSync` before search runs; no change needed.

## Feature 3 — Custom-provider capability probing

Per-model live probes for (primarily custom) OpenAI-compatible endpoints; results persisted into the existing `capabilityOverrides` mechanism so `ModelPicker` and the rest of the app automatically honor them.

### Steps

1. `app/lib/types.ts`: extend `ProviderConfig.openAICompatible.capabilityOverrides` (line 65-72) with `embeddings?: boolean` and `streaming?: boolean`.
2. New server lib `app/lib/server/capability-probe.ts`:
   - `probeModelCapabilities(req): Promise<ProbeReport>` where `ProbeReport = { model; capabilities: Record<ProbeKey, boolean | null>; latencyMs; errors: Record<ProbeKey, string> }`.
   - Probes (all bounded; default per-probe timeout ~10s; `maxTokens` tiny; temperature 0):
     - `streaming`: `streamText` with "Say OK", true if a text chunk arrives.
     - `tools`: `generateText` with an echo tool (`execute` returns true), prompt instructing the call; true if a tool call is received.
     - `structuredOutput`: `generateText` with `experimental_output` (zod `{ ok: boolean }`); true if parsed output returns.
     - `vision`: image part with a 1×1 red PNG data URL + "What color? Reply with one word."; true if any text returns (best-effort).
     - `embeddings`: direct `POST {root}/embeddings` (`{ input: "test", model }`) via `createCompatibleFetch`; true on 200 + `data[0].embedding` array.
     - `responses`: direct `POST {root}/responses` minimal body; true on 200/201, false on 4xx (best-effort).
     - `reasoning`: request with `reasoningEffort: "low"`, detect reasoning parts; `null` (unknown) when inconclusive.
   - Never abort the whole report on a single probe failure; record `{ capability: false, error }`.
   - Construct models via the existing `createChatModel`/`createOpenAI` + `createCompatibleFetch` path in `app/lib/server/model.ts` (custom branch, lines 106-123).
3. New route `app/routes/api.capabilities.ts` (POST only, mirroring `api.models.ts`): CORS preflight (`corsPreflight`/`withCors`), JSON body parse, `normalizeProviderBaseUrl` (SSRF-safe), require `provider` + `model`, relay `apiKey`/`headers`/`authMode`/`timeoutMs`/`maxRetries` from the browser (BYOK — never env vars). Return `{ report, resolvedBaseUrl }`.
4. New client lib `app/lib/capability-probe.ts`: `probeModelCapabilities(opts): Promise<ProbeReport>` POSTing `/api/capabilities` with the same request shape used by `testProviderKey` (`key-test.ts:59-100`).
5. UI in `AppSidebar.tsx` ProviderPicker advanced section (`app/components/sidebar/AppSidebar.tsx` ~lines 2218-2400, custom provider only, next to `manualModelId`):
   - "Probe model capabilities" button; loading state; renders ✓/✗/unknown per probe + latency + per-probe errors.
   - "Apply to overrides" button → `setDraftCompatible({ ...draftCompatible, capabilityOverrides: { ...draftCompatible.capabilityOverrides, tools, vision, structuredOutput, reasoning, embeddings, streaming } })` using only non-null probe results.
   - `ModelPicker.useProviderModels` (`app/components/ui/ModelPicker.tsx:87-91`) already spreads overrides onto `ModelInfo`; add `embeddings`/`streaming` to that spread (ModelPicker.tsx:87-91) so probed flags propagate to the picker.
6. README.md:
   - Remove "custom-provider capability probing" from Coming soon (line 15).
   - Note in the OpenAI-Compatible section that probing is best-effort, bounded, costs a tiny number of tokens, and results can be applied as capability overrides; do not treat probe results as authoritative (per the existing disclaimer at README.md:118).

### Edge cases / scope

- Probe route accepts any provider but the UI entry point is the custom provider advanced section.
- `ALLOW_PRIVATE_PROVIDER_URLS` / SSRF rules already enforced via `normalizeProviderBaseUrl` — no new bypass.
- Keys remain per-request relayed (BYOK trust boundary unchanged, README.md:62-66).
- Failures must degrade to "unknown/false" per capability, never block saving the connection.

## Validation

- `npm run typecheck` (release gate per README).
- `npm run build && npm start`, then manual:
  1. `ask_user`: trigger via a model that calls it; answer single/multiple/short; Skip; two concurrent questions; preview workspace ask; confirm no native `prompt()` appears and subagent ask still returns the canned message.
  2. Search: type a phrase from an old message; snippet + highlight; click opens the right thread; no match empty state.
  3. Probing: run against Ollama/LM Studio locally and a mock OpenAI-compatible endpoint (e.g., `npx` mock or the app's own custom provider pointed at a small test server); verify report, apply-to-overrides, and ModelPicker badges/behavior; confirm a failed probe doesn't block Save.
- Verify README table/Coming-soon edits render correctly.

## Risks

- In-flight uncommitted subagent refactor may fail typecheck; fix it first, and coordinate edits to `AssistantRuntimeProvider.tsx` and `home.tsx` so subagent wiring is untouched.
- Probe token cost is small but nonzero; keep `maxTokens` and image payload minimal, and let users run probes explicitly (no auto-probe on connect).
- `PreviewWorkspace.tsx` is a second `ask_user`/tool-call site — both must be updated or the native prompt remains in preview mode.
