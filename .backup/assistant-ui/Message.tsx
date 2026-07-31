/**
 * Message — Assistant and User message rendering for PrismiumLite
 *
 * Features:
 * - User bubble: rounded pill, right-aligned
 * - Assistant: Search avatar + streaming markdown text
 * - Reasoning: collapsible "Thinking…" block via ChainOfThoughtPrimitive
 * - Copy action on assistant messages
 */

import {
    MessagePrimitive,
    ActionBarPrimitive,
    ChainOfThoughtPrimitive,
    type ReasoningMessagePartProps,
    type TextMessagePartProps,
} from "@assistant-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    Copy,
    Check,
    User,
    MagnifyingGlass,
    CaretDown,
    CaretRight,
    Spinner,
} from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "~/lib/utils/cn";

/* ──────────────────────────────────────── exports ──── */

export const Message = {
    User: UserMessage,
    Assistant: AssistantMessage,
};

/* ──────────────────────────────────────── User ──────── */

function UserMessage() {
    return (
        <MessagePrimitive.Root className="flex justify-end px-4 py-3">
            <div className="flex max-w-[75%] items-end gap-2">
                <div className="rounded-3xl rounded-tr-md border border-border/40 bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                    <MessagePrimitive.Parts />
                </div>
                <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border">
                    <User size={14} className="text-muted-foreground" />
                </div>
            </div>
        </MessagePrimitive.Root>
    );
}

/* ──────────────────────────────────────── Assistant ─── */

function AssistantMessage() {
    return (
        <MessagePrimitive.Root className="flex gap-3 px-4 py-3">
            {/* Search-icon avatar (Perplexity style) */}
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary ring-1 ring-border/30">
                <MagnifyingGlass size={14} className="text-primary" weight="bold" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
                {/* Reasoning block */}
                <ChainOfThoughtPrimitive.Root>
                    <ReasoningSection />
                </ChainOfThoughtPrimitive.Root>

                {/* Main content parts */}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                    <MessagePrimitive.Parts
                        components={{
                            Text: TextPart,
                            Reasoning: ReasoningPartInline,
                        }}
                    />
                </div>

                {/* Copy action bar */}
                <AssistantActionBar />
            </div>
        </MessagePrimitive.Root>
    );
}

/* ──────────────────────────────────────── Reasoning ─── */

function ReasoningSection() {
    const [open, setOpen] = useState(false);

    return (
        <div className="mb-1 rounded-xl border border-primary/20 bg-primary/5">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-primary/80 hover:text-primary"
            >
                {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
                <Spinner size={12} className={cn("animate-spin", !open && "hidden")} />
                <span>Thinking…</span>
            </button>

            {open && (
                <div className="border-t border-primary/10 px-3 py-2">
                    <ChainOfThoughtPrimitive.Parts />
                </div>
            )}
        </div>
    );
}

function ReasoningPartInline(props: ReasoningMessagePartProps) {
    const textContent = (props as any).reasoning || (props as any).text || "";
    return (
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            {textContent}
        </p>
    );
}

/* ──────────────────────────────────────── Text part ─── */

function TextPart(props: TextMessagePartProps) {
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {props.text}
        </ReactMarkdown>
    );
}

/* ──────────────────────────────────────── Action Bar ─── */

function AssistantActionBar() {
    return (
        <ActionBarPrimitive.Root
            hideWhenRunning
            autohide="not-last"
            className="flex items-center gap-1"
        >
            <ActionBarPrimitive.Copy asChild>
                <CopyButton />
            </ActionBarPrimitive.Copy>
        </ActionBarPrimitive.Root>
    );
}

function CopyButton() {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Copy response"
        >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
        </button>
    );
}