/**
 * Composer — Perplexity-style rounded card composer for PrismiumLite
 *
 * Features:
 * - rounded-3xl card with border and soft shadow
 * - rows={2} textarea with Enter-to-send
 * - Search mode picker (Search / Deep Research / Labs) 
 * - Model picker dropdown (all 5 providers, hidden on mobile)
 * - Four-state action button: Cancel → StopDictation → Send → Dictate
 * - Haptic feedback on send
 */

import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import TextareaAutosize from "react-textarea-autosize";
import {
    MagnifyingGlass,
    Binoculars,
    Flask,
    Microphone,
    StopCircle,
    ArrowUp,
    X,
    CaretDown,
    Check,
    Plus,
} from "@phosphor-icons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { DEFAULT_MODELS, PROVIDER_DEFAULTS, type ProviderId } from "~/lib/types";
import { cn } from "~/lib/utils/cn";

/* ─── Search modes ──────────────────────────────────────── */
const SEARCH_MODES = [
    { id: "search", name: "Search", desc: "Fast answers to everyday questions", Icon: MagnifyingGlass },
    { id: "research", name: "Research", desc: "In-depth reports on complex topics", Icon: Binoculars },
    { id: "labs", name: "Labs", desc: "Deep analysis with web tools + Python", Icon: Flask },
];

function SearchModePicker() {
    const [mode, setMode] = useState("search");
    const current = SEARCH_MODES.find((m) => m.id === mode) ?? SEARCH_MODES[0];
    const Icon = current.Icon;

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                    <Icon size={13} weight="bold" className="text-primary" />
                    <span>{current.name}</span>
                    <CaretDown size={10} className="text-muted-foreground" />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 min-w-[220px] rounded-xl border border-border bg-popover p-1.5 shadow-lg"
                >
                    {SEARCH_MODES.map((m) => {
                        const MIcon = m.Icon;
                        return (
                            <DropdownMenu.Item
                                key={m.id}
                                onClick={() => setMode(m.id)}
                                className="flex cursor-pointer items-start gap-3 rounded-lg p-2.5 text-sm outline-none hover:bg-accent"
                            >
                                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary">
                                    {mode === m.id
                                        ? <Check size={13} className="text-primary" weight="bold" />
                                        : <MIcon size={13} />}
                                </div>
                                <div>
                                    <div className="font-medium leading-none">{m.name}</div>
                                    <div className="mt-0.5 text-[11px] text-muted-foreground">{m.desc}</div>
                                </div>
                            </DropdownMenu.Item>
                        );
                    })}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

/* ─── Model picker (hidden on mobile) ───────────────────── */
function ModelPicker() {
    const { settings, updateChat } = useSettings();
    const providerModels = DEFAULT_MODELS[settings.chat.provider] ?? [];
    const currentModel = providerModels.find((m) => m.id === settings.chat.model);

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:flex">
                    <span className="max-w-[130px] truncate">{currentModel?.name ?? settings.chat.model}</span>
                    <CaretDown size={10} className="text-muted-foreground" />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 max-h-80 min-w-[240px] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg"
                >
                    {(Object.keys(PROVIDER_DEFAULTS) as ProviderId[]).map((pid) => {
                        const models = DEFAULT_MODELS[pid] ?? [];
                        if (!models.length) return null;
                        return (
                            <div key={pid}>
                                <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {PROVIDER_DEFAULTS[pid].name}
                                </div>
                                {models.map((m) => (
                                    <DropdownMenu.Item
                                        key={m.id}
                                        onClick={() => updateChat({ provider: pid, model: m.id })}
                                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                                    >
                                        {settings.chat.model === m.id && (
                                            <Check size={11} className="shrink-0 text-primary" weight="bold" />
                                        )}
                                        <span className={cn(settings.chat.model === m.id ? "font-semibold text-foreground" : "text-muted-foreground", "truncate")}>
                                            {m.name}
                                        </span>
                                    </DropdownMenu.Item>
                                ))}
                            </div>
                        );
                    })}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}

/* ─── Four-state primary action ─────────────────────────── */
function ComposerPrimaryAction() {
    const haptic = () => {
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    };
    const base = "flex h-8 w-8 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

    return (
        <>
            <AuiIf condition={(s) => s.thread.isRunning}>
                <ComposerPrimitive.Cancel asChild>
                    <button onClick={haptic} className={cn(base, "bg-destructive text-white hover:bg-destructive/80")} title="Stop generation">
                        <X size={14} weight="bold" />
                    </button>
                </ComposerPrimitive.Cancel>
            </AuiIf>
            <AuiIf condition={(s) => !s.thread.isRunning && s.composer.dictation != null}>
                <ComposerPrimitive.StopDictation asChild>
                    <button onClick={haptic} className={cn(base, "bg-warning text-white")} title="Stop dictation">
                        <StopCircle size={15} weight="fill" />
                    </button>
                </ComposerPrimitive.StopDictation>
            </AuiIf>
            <AuiIf condition={(s) => !s.thread.isRunning && s.composer.dictation == null && !s.composer.isEmpty}>
                <ComposerPrimitive.Send asChild>
                    <button onClick={haptic} className={cn(base, "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95")} title="Send (Enter)">
                        <ArrowUp size={15} weight="bold" />
                    </button>
                </ComposerPrimitive.Send>
            </AuiIf>
            <AuiIf condition={(s) => !s.thread.isRunning && s.composer.dictation == null && s.composer.isEmpty}>
                <ComposerPrimitive.Dictate asChild>
                    <button onClick={haptic} className={cn(base, "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground")} title="Voice input">
                        <Microphone size={15} />
                    </button>
                </ComposerPrimitive.Dictate>
            </AuiIf>
        </>
    );
}

/* ─── Main Composer shell ────────────────────────────────── */
interface ComposerProps {
    placeholder?: string;
}

export function Composer({ placeholder = "Ask anything…" }: ComposerProps) {
    return (
        <ComposerPrimitive.Root
            className={cn(
                "w-full rounded-3xl border border-border/70 bg-card shadow-md transition-shadow",
                "focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_rgb(99_102_241/0.12)]"
            )}
        >
            {/* Textarea */}
            <ComposerPrimitive.Input asChild>
                <TextareaAutosize
                    rows={2}
                    minRows={2}
                    maxRows={8}
                    placeholder={placeholder}
                    className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                        }
                    }}
                />
            </ComposerPrimitive.Input>

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1">
                <div className="flex items-center gap-2">
                    <ComposerPrimitive.AddAttachment asChild>
                        <button
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            title="Attach file"
                        >
                            <Plus size={14} weight="bold" />
                        </button>
                    </ComposerPrimitive.AddAttachment>
                    <SearchModePicker />
                </div>
                <div className="flex items-center gap-2">
                    <ModelPicker />
                    <ComposerPrimaryAction />
                </div>
            </div>
        </ComposerPrimitive.Root>
    );
}