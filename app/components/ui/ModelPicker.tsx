/**
 * ModelPicker — searchable model dropdown (full live provider catalog).
 */

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { Command } from "cmdk";
import {
    CaretDown,
    Check,
    ImageSquare,
    MagnifyingGlass,
    SpinnerGap,
} from "@phosphor-icons/react";
import { hapticSelect } from "~/lib/haptics";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import {
    enrichModelInfo,
    inferModelSupportsImageGeneration,
    inferModelSupportsTools,
} from "~/lib/model-capabilities";
import { cn } from "~/lib/utils";
import { localProviderKey } from "~/lib/provider-credentials";

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
                    apiKey: apiKey || localProviderKey(provider),
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

export function SearchableModelSelect({
    models,
    value,
    onChange,
    className,
}: {
    models: ModelInfo[];
    value: string;
    onChange: (modelId: string) => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
    const selected = models.find((model) => model.id === value);

    useEffect(() => {
        if (!open) return;
        const onDocumentMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                !rootRef.current?.contains(target) &&
                !menuRef.current?.contains(target)
            ) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocumentMouseDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onDocumentMouseDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    useLayoutEffect(() => {
        if (!open) {
            setMenuStyle(null);
            return;
        }
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const menuHeight = 328;
            const width = Math.min(360, window.innerWidth - 16);
            const openAbove =
                window.innerHeight - rect.bottom < menuHeight + 8 &&
                rect.top > window.innerHeight - rect.bottom;
            const style: React.CSSProperties = {
                position: "fixed",
                top: openAbove
                    ? Math.max(8, rect.top - menuHeight - 6)
                    : Math.min(
                          Math.max(8, window.innerHeight - menuHeight - 8),
                          rect.bottom + 6,
                      ),
                left: Math.min(
                    Math.max(8, rect.left),
                    Math.max(8, window.innerWidth - width - 8),
                ),
                width,
                maxHeight: "min(20rem, calc(100vh - 1rem))",
                zIndex: 100,
            };
            setMenuStyle(style);
        };
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    hapticSelect();
                    setOpen((current) => !current);
                }}
                className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-input bg-background px-3 text-left outline-none transition-colors hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Choose model"
            >
                <span className="min-w-0 truncate text-sm font-medium">
                    {selected?.name || value || "Choose a model"}
                </span>
                <CaretDown
                    size={15}
                    className={cn(
                        "shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180",
                    )}
                />
            </button>

            {open && menuStyle
                ? createPortal(
                    <div
                        ref={menuRef}
                        style={menuStyle}
                        className="overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20"
                    >
                    <Command className="flex max-h-80 flex-col" label="Choose model">
                        <div className="flex items-center gap-2 border-b border-border px-3">
                            <MagnifyingGlass
                                size={14}
                                className="shrink-0 text-muted-foreground"
                            />
                            <Command.Input
                                placeholder={`Search ${models.length} models…`}
                                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                autoFocus
                            />
                        </div>
                        <Command.List className="overflow-y-auto p-1">
                            <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                                No models match.
                            </Command.Empty>
                            {models.map((model) => (
                                <Command.Item
                                    key={model.id}
                                    value={`${model.name} ${model.id}`}
                                    onSelect={() => {
                                        hapticSelect();
                                        onChange(model.id);
                                        setOpen(false);
                                    }}
                                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs outline-none aria-selected:bg-accent"
                                >
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-1.5 truncate font-medium">
                                            {model.name || model.id}
                                            {model.supportsImageGeneration ? (
                                                <ImageSquare
                                                    size={12}
                                                    weight="duotone"
                                                    className="shrink-0 text-primary"
                                                    aria-label="Image generation model"
                                                />
                                            ) : null}
                                        </span>
                                        {model.name !== model.id ? (
                                            <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                                                {model.id}
                                            </span>
                                        ) : null}
                                    </span>
                                    {model.id === value ? (
                                        <Check
                                            size={14}
                                            weight="bold"
                                            className="shrink-0 text-primary"
                                        />
                                    ) : null}
                                </Command.Item>
                            ))}
                        </Command.List>
                    </Command>
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
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
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);

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
        if (
            inferModelSupportsTools(value, provider) ||
            inferModelSupportsImageGeneration(value, provider)
        ) {
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
            const target = e.target as Node;
            if (
                !rootRef.current?.contains(target) &&
                !menuRef.current?.contains(target)
            ) {
                setOpen(false);
            }
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

    useLayoutEffect(() => {
        if (!open) {
            setMenuStyle(null);
            return;
        }
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const menuHeight = 328;
            const width = Math.min(352, window.innerWidth - 16);
            const openAbove =
                window.innerHeight - rect.bottom < menuHeight + 8 &&
                rect.top > window.innerHeight - rect.bottom;
            const top = openAbove
                ? Math.max(8, rect.top - menuHeight - 6)
                : Math.min(
                      Math.max(8, window.innerHeight - menuHeight - 8),
                      rect.bottom + 6,
                  );
            const style: React.CSSProperties = {
                position: "fixed",
                top,
                width,
                maxHeight: "min(20rem, calc(100vh - 1rem))",
                zIndex: 100,
            };
            if (align === "right") {
                style.right = Math.min(
                    Math.max(8, window.innerWidth - rect.right),
                    Math.max(8, window.innerWidth - width - 8),
                );
            } else {
                style.left = Math.min(
                    Math.max(8, rect.left),
                    Math.max(8, window.innerWidth - width - 8),
                );
            }
            setMenuStyle(style);
        };
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [align, compact, open]);

    // Do NOT auto-call onChange when the catalog loads — that was resetting
    // the user's selected model after sends / refreshes.

    if (!enabled) return null;

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            <button
                ref={triggerRef}
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

            {open && menuStyle
                ? createPortal(
                    <div
                        ref={menuRef}
                        style={menuStyle}
                        className="overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
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
                                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                                        {m.name}
                                        {m.supportsImageGeneration ? (
                                            <ImageSquare
                                                size={12}
                                                weight="duotone"
                                                className="shrink-0 text-primary"
                                                aria-label="Image generation model"
                                            />
                                        ) : null}
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
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
}
