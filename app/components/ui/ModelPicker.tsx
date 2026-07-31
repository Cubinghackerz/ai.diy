/**
 * ModelPicker — searchable model dropdown (full live provider catalog).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import { CaretDown, MagnifyingGlass, SpinnerGap } from "@phosphor-icons/react";
import { hapticSelect } from "~/lib/haptics";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import {
    enrichModelInfo,
    inferModelSupportsTools,
} from "~/lib/model-capabilities";
import { cn } from "~/lib/utils";

export function useProviderModels(provider: ProviderId, enabled: boolean) {
    const { settings } = useSettings();
    const [models, setModels] = useState<ModelInfo[]>(() =>
        (DEFAULT_MODELS[provider] ?? []).map(enrichModelInfo),
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const apiKey = settings.providers[provider]?.apiKey || "";
    const baseUrl = settings.providers[provider]?.baseUrl;

    const refresh = useCallback(async () => {
        if (!enabled) {
            setModels((DEFAULT_MODELS[provider] ?? []).map(enrichModelInfo));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider,
                    apiKey:
                        apiKey ||
                        (provider === "ollama"
                            ? "ollama"
                            : provider === "custom"
                              ? "custom"
                              : ""),
                    baseUrl: baseUrl || undefined,
                }),
            });
            const data = (await res.json()) as {
                models?: ModelInfo[];
                error?: string;
            };
            const raw =
                data.models && data.models.length > 0
                    ? data.models.map((m) =>
                          enrichModelInfo({
                              ...m,
                              id: m.id,
                              name: m.name || m.id,
                              provider,
                          }),
                      )
                    : (DEFAULT_MODELS[provider] ?? []).map(enrichModelInfo);
            const next = raw;
            setModels(next);
            if (!res.ok || data.error) {
                setError(
                    data.error || `Failed to load models (HTTP ${res.status})`,
                );
                setModels(
                    (DEFAULT_MODELS[provider] ?? []).map(enrichModelInfo),
                );
            }
        } catch (err) {
            setModels(
                (DEFAULT_MODELS[provider] ?? []).map(enrichModelInfo),
            );
            setError(
                err instanceof Error ? err.message : "Failed to load models",
            );
        } finally {
            setLoading(false);
        }
    }, [enabled, provider, apiKey, baseUrl]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { models, loading, error, refresh };
}

export function ModelPicker({
    provider,
    value,
    onChange,
    enabled,
    className,
    align = "right",
    compact = false,
}: {
    provider: ProviderId;
    value: string;
    onChange: (modelId: string) => void;
    enabled: boolean;
    className?: string;
    align?: "left" | "right";
    compact?: boolean;
}) {
    const { models, loading, error, refresh } = useProviderModels(
        provider,
        enabled,
    );
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    const selected = useMemo(() => {
        const hit = models.find((m) => m.id === value);
        if (hit) return hit;
        if (!value) return null;
        // Keep the user's selection visible even if the live catalog uses a
        // different id shape (e.g. llama3 vs llama3:latest).
        return { id: value, name: value, provider } satisfies ModelInfo;
    }, [models, value, provider]);

    const options = useMemo(() => {
        const availableModels = models.map(enrichModelInfo);
        if (!value || availableModels.some((m) => m.id === value)) {
            return availableModels;
        }
        // Keep current selection visible if it was set before the live catalog loaded.
        if (inferModelSupportsTools(value, provider)) {
            return [
                enrichModelInfo({
                    id: value,
                    name: value,
                    provider,
                    supportsTools: true,
                }),
                ...availableModels,
            ];
        }
        return availableModels;
    }, [models, value, provider]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // Do NOT auto-call onChange when the catalog loads — that was resetting
    // the user's selected model after sends / refreshes.

    if (!enabled) return null;

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            <button
                type="button"
                onClick={() => {
                    hapticSelect();
                    setOpen((v) => !v);
                    if (!open) void refresh();
                }}
                className={cn(
                    "flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-transparent font-medium outline-none transition-colors hover:border-border hover:bg-muted/40",
                    compact
                        ? "h-7 py-0.5 pr-1.5 pl-2 text-[11px]"
                        : "h-8 bg-background py-1 pr-2 pl-2.5 text-xs",
                )}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="truncate">
                    {selected?.name || value || "Select model"}
                </span>
                {loading ? (
                    <SpinnerGap size={12} className="shrink-0 animate-spin" />
                ) : (
                    <CaretDown size={12} className="shrink-0 text-muted-foreground" />
                )}
            </button>

            {open ? (
                <div
                    className={cn(
                        "absolute z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
                        compact
                            ? "bottom-[calc(100%+6px)]"
                            : "top-[calc(100%+6px)]",
                        align === "right" ? "right-0" : "left-0",
                    )}
                >
                    <Command
                        className="flex max-h-80 flex-col"
                        label="Search models"
                    >
                        <div className="flex items-center gap-2 border-b border-border px-3">
                            <MagnifyingGlass
                                size={14}
                                className="shrink-0 text-muted-foreground"
                            />
                            <Command.Input
                                placeholder={`Search ${options.length} models…`}
                                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                autoFocus
                            />
                        </div>
                        {error ? (
                            <p className="px-3 py-2 text-[11px] text-warning">
                                {error} — showing available list.
                            </p>
                        ) : null}
                        <Command.List className="overflow-y-auto p-1">
                            <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                                 No models match.
                            </Command.Empty>
                            {options.map((m) => (
                                <Command.Item
                                    key={m.id}
                                    value={`${m.name} ${m.id}`}
                                    onSelect={() => {
                                        hapticSelect();
                                        onChange(m.id);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex cursor-pointer flex-col gap-0.5 rounded-lg px-2.5 py-2 text-xs outline-none aria-selected:bg-accent",
                                        m.id === value && "bg-accent/70",
                                    )}
                                >
                                    <span className="font-medium text-foreground">
                                        {m.name}
                                    </span>
                                    {m.name !== m.id ? (
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                            {m.id}
                                        </span>
                                    ) : null}
                                </Command.Item>
                            ))}
                        </Command.List>
                    </Command>
                </div>
            ) : null}
        </div>
    );
}
