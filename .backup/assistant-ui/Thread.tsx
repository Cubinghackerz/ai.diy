/**
 * Thread — Perplexity-style chat view
 *
 * Empty state: centered wordmark + tall hero composer + suggestion chips
 * Chat state: scrollable messages + sticky pinned follow-up composer footer
 */

import { AuiIf, ThreadPrimitive } from "@assistant-ui/react";
import { Composer } from "./Composer";
import { Message } from "./Message";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { MagnifyingGlass, Code, PencilSimple, ChartBar, Lightbulb, SunDim } from "@phosphor-icons/react";

/* ─── Suggestion chips in empty state ──────────────────── */
const SUGGESTIONS = [
    { label: "Weather", icon: SunDim, prompt: "What is the weather like in Tokyo right now?" },
    { label: "Code", icon: Code, prompt: "Write a clean TypeScript React hook for dark mode" },
    { label: "Write", icon: PencilSimple, prompt: "Draft a concise product launch announcement email" },
    { label: "Analyze", icon: ChartBar, prompt: "Analyze the key differences between GPT-5 and Claude 4" },
    { label: "Brainstorm", icon: Lightbulb, prompt: "Brainstorm 5 novel SaaS product ideas for 2026" },
];

function SuggestionChips() {
    const handleSend = (prompt: string) => {
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
        const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
        if (textarea) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
            nativeInputValueSetter?.call(textarea, prompt);
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            textarea.form?.requestSubmit();
        }
    };

    return (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                    <button
                        key={s.label}
                        onClick={() => handleSend(s.prompt)}
                        className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-accent hover:text-foreground"
                    >
                        <Icon size={13} className="text-primary" weight="bold" />
                        {s.label}
                    </button>
                );
            })}
        </div>
    );
}

/* ─── Empty State ───────────────────────────────────────── */
function EmptyState() {
    const { settings, loaded } = useSettings();
    const hasApiKey = loaded && !!settings.providers[settings.chat.provider]?.apiKey;

    return (
        <div className="flex min-h-full flex-col items-center justify-center px-4 pb-8 pt-16 animate-fade-in">
            {/* Wordmark */}
            <h1 className="mb-8 bg-gradient-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-5xl font-bold tracking-tighter text-transparent sm:text-[3.25rem]">
                PrismiumLite
            </h1>

            {!hasApiKey && (
                <div className="mb-6 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning">
                    <span>🔑</span>
                    <span>Enter your API key in Settings (⚙ icon) to start chatting.</span>
                </div>
            )}

            {/* Hero composer */}
            <div className="w-full max-w-[40rem]">
                <Composer placeholder="Ask anything…" />
                <SuggestionChips />
            </div>
        </div>
    );
}

/* ─── Main Thread ────────────────────────────────────────── */
export function Thread() {
    return (
        <ThreadPrimitive.Root
            className="relative flex h-full flex-col bg-background"
            style={{ ["--thread-max-width" as string]: "48rem" }}
        >
            {/* Empty state — full page centered hero */}
            <AuiIf condition={(s) => s.thread.isEmpty}>
                <EmptyState />
            </AuiIf>

            {/* Active chat — messages + sticky footer composer */}
            <AuiIf condition={(s) => !s.thread.isEmpty}>
                <ThreadPrimitive.Viewport autoScroll className="flex-1 overflow-y-auto">
                    {/* Message list */}
                    <div className="mx-auto w-full max-w-[var(--thread-max-width,48rem)] px-4 py-6">
                        <ThreadPrimitive.Messages
                            components={{
                                UserMessage: Message.User,
                                AssistantMessage: Message.Assistant,
                            }}
                        />
                    </div>

                    {/* Sticky follow-up footer */}
                    <ThreadPrimitive.ViewportFooter className="sticky bottom-0 w-full">
                        {/* Fade gradient over background */}
                        <div className="h-10 w-full bg-gradient-to-t from-background to-transparent" />
                        <div className="bg-background pb-6">
                            <div className="mx-auto w-full max-w-[var(--thread-max-width,48rem)] px-4">
                                <Composer placeholder="Ask a follow-up…" />
                            </div>
                        </div>
                    </ThreadPrimitive.ViewportFooter>
                </ThreadPrimitive.Viewport>
            </AuiIf>
        </ThreadPrimitive.Root>
    );
}