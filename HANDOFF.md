# PrismiumLite — Agent Handoff Prompt

Copy everything below the `---` line and paste it to your next AI agent session to seamlessly continue development:

---

## Project: PrismiumLite — Open-Source Local-First TypingMind Clone

**Working directory:** `/Users/nirneet/Documents/GitHub/PrismiumLite`

**Stack:** React Router v8 (SSR), Vite, Tailwind CSS v4, assistant-ui, Vercel AI SDK, TypeScript, Radix UI, idb (IndexedDB)

**Goal:** Build a privacy-first, local-only AI chat workspace (TypingMind / Perplexity clone) with BYOK, local Ollama / LM Studio support, DuckDuckGo web search, Python execution, Canvas artifacts, reasoning display, and MCP tools.

---

### What Is Already Completed

1. **Vercel AI SDK Backend (`app/routes/api.chat.ts`)**:
   - Uses `streamText` + `toTextStreamResponse()`
   - Supports 7 providers: OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, Ollama (Local `http://localhost:11434/v1`), and Custom Proxy (`http://localhost:1234/v1`).
   - Enables multi-turn tool calling (`stopWhen: stepCountIs(5)`) for `web_search` (DuckDuckGo), `fetch_url`, `calculator`, `run_python`, and `create_file`.
   - Includes default privacy-first AI system prompt.

2. **assistant-ui Integration (`app/components/assistant-ui/AssistantRuntimeProvider.tsx`)**:
   - Uses `useChatRuntime` + `AssistantChatTransport` from `@assistant-ui/react-ai-sdk` to connect directly to `/api/chat`.
   - Passes BYOK credentials, model selection, temperature, and tool toggles in request body.

3. **Perplexity-Style UI (`Thread.tsx`, `Composer.tsx`, `Message.tsx`)**:
   - **Hero Empty State**: Centered gradient wordmark ("PrismiumLite") + multi-line rounded-3xl card composer + quick suggestion chips (Weather, Code, Write, Analyze, Brainstorm).
   - **Composer Controls**: Search mode picker (Search / Deep Research / Labs), Model picker dropdown (all 5 providers), and 4-state primary action button (Cancel → StopDictation → Send → Dictate).
   - **Chat State**: Auto-scrolling message list with sticky follow-up footer + fade-out background gradient.
   - **Reasoning Display**: Collapsible "Thinking…" chain-of-thought accordion via `ChainOfThoughtPrimitive` + `ReasoningPartInline`.

4. **Canvas Panel (`app/components/canvas/CanvasPanel.tsx`, `app/lib/canvas.tsx`)**:
   - Slide-out side drawer for interactive HTML previews (sandboxed iframe), Python execution output, code snippets, and file downloads (CSV, Markdown, JSON, SVG).

5. **IndexedDB Thread History (`app/lib/db.ts`, `app/lib/hooks/useThreads.ts`)**:
   - Client-side persistence using `idb` for chat threads and messages.
   - Sidebar thread list with active highlight, "+ New Thread", and thread deletion.

6. **Preferences & Settings (`app/routes/home.tsx`)**:
   - Radix UI Tabbed Dialog for API Keys (BYOK), Model Parameters, Web Search & Tools toggles, MCP Server endpoints, and Appearance themes (Dark, Light, System).
   - Keyboard shortcuts (`Cmd+K` for new chat, `Cmd+,` for settings).

7. **TypeScript & Build**:
   - Clean compilation under `app/` (`npx tsc --noEmit` passes cleanly).

---

### Suggested Next Features / Next Steps

1. **Local RAG / Knowledge Base**:
   - Allow dragging & dropping PDF/text files into a local document store (IndexedDB) and injecting relevant content snippets into chat context.
2. **Prompt Library Modal**:
   - Add a prompt template library popup triggered by typing `/` in the composer or clicking a prompt library button.
3. **MCP Server Tool Execution UI**:
   - Connect added SSE/HTTP MCP server tool definitions into the assistant-ui tool stream.
4. **Chat Export & Import**:
   - Add export thread to JSON / Markdown / HTML button and import from ChatGPT JSON.

---

### Run Commands

> **Important:** `npm run dev` has a known composer input regression (inputs drop keystrokes). The **only supported local run path is the production build.**

- `npm run build && npm start` — **THE correct way to run the app.** Builds the production bundle, then serves it locally on `http://localhost:3000` (script: `react-router-serve ./build/server/index.js`).
- `npm run typecheck` — Type-check the codebase (runs `react-router typegen && tsc`).
- `npm run build` — Test the production build (same as above WITHOUT starting the server).
- `npm start` — Serve the existing `build/` on `http://localhost:3000` (only after `npm run build`).
