/**
 * ModelPicker — searchable model dropdown (full live provider catalog).
 */

import {
    useCallback,
    useEffect,
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
    SpeakerHigh,
    SpinnerGap,
    VideoCamera,
} from "@phosphor-icons/react";
import { hapticSelect } from "~/lib/haptics";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { DEFAULT_MODELS, type ModelInfo, type ProviderId } from "~/lib/types";
import {
    enrichModelInfo,
    inferModelSupportsImageGeneration,
    inferModelSupportsTools,
} from "~/lib/model-capabilities";
import {
    lookupInCatalog,
    useModelCatalog,
} from "~/lib/model-catalog-cache";
import {
    mergeCatalogInfo,
    type MergedModelInfo,
} from "~/lib/model-catalog";
import { ModelHoverCard } from "~/components/ui/ModelHoverCard";
import { ModelLogo } from "~/components/ui/ModelLogo";
import { cn } from "~/lib/utils";
import { localProviderKey } from "~/lib/provider-credentials";
import { useAnchoredMenu } from "~/lib/use-anchored-menu";

function ModelBadges({
    model,
    catalog,
}: {
    model: ModelInfo;
    catalog?: ReturnType<typeof useModelCatalog>;
}) {
    const entry = catalog
        ? lookupInCatalog(catalog, model.provider, model.id)
        : undefined;
    const image = model.supportsImageGeneration ?? entry?.imageOutput === true;
    const video = model.supportsVideo ?? entry?.videoOutput === true;
    const audio = model.supportsAudio ?? entry?.audioOutput === true;
    return (
        <>
            {image ? (
                <ImageSquare
                    size={12}
                    weight="duotone"
                    className="shrink-0 text-primary"
                    aria-label="Image generation model"
                />
            ) : null}
            {video ? (
                <VideoCamera
                    size={12}
                    weight="duotone"
                    className="shrink-0 text-primary"
                    aria-label="Video generation model"
                />
            ) : null}
            {audio ? (
                <SpeakerHigh
                    size={12}
                    weight="duotone"
                    className="shrink-0 text-primary"
                    aria-label="Audio output model"
                />
            ) : null}
        </>
    );
}

function useHoveredModel() {
    const catalog = useModelCatalog();
    const [hovered, setHovered] = useState<{
        model: ModelInfo;
        rect: { top: number; bottom: number; left: number; right: number };
        placement: "above" | "side";
    } | null>(null);
    const merged: MergedModelInfo | null = hovered
        ? mergeCatalogInfo(
              hovered.model,
              lookupInCatalog(catalog, hovered.model.provider, hovered.model.id),
          )
        : null;
    return { hovered, setHovered, merged };
}

export function useProviderModels(provider: ProviderId, enabled: boolean) {
    const { settings } = useSettings();
    const [models, setModels] = useState<ModelInfo[]>(() =>
        (DEFAULT_MODELS[provider] ?? []).map(enrichModelInfo),
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const apiKey = settings.providers[provider]?.apiKey || "";
    const baseUrl = settings.providers[provider]?.baseUrl;
    const compatibleHeaders = settings.providers[provider]?.openAICompatible?.headers;
    const timeoutMs = settings.providers[provider]?.openAICompatible?.timeoutMs;
    const maxRetries = settings.providers[provider]?.openAICompatible?.maxRetries;
    const authMode = settings.providers[provider]?.openAICompatible?.authMode;
    const capabilityOverrides = settings.providers[provider]?.openAICompatible?.capabilityOverrides;

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
                credentials: "include",
                body: JSON.stringify({
                    provider,
                    apiKey:
                        provider === "chatgpt"
                            ? ""
                            : provider === "custom" &&
                                settings.providers[provider]?.openAICompatible?.authMode &&
                                settings.providers[provider].openAICompatible.authMode !== "bearer"
                              ? ""
                              : apiKey || localProviderKey(provider),
                    baseUrl: baseUrl || undefined,
                    headers: compatibleHeaders,
                    timeoutMs,
                    maxRetries,
                    authMode,
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
                              ...(capabilityOverrides?.tools === undefined ? {} : { supportsTools: capabilityOverrides.tools }),
                              ...(capabilityOverrides?.vision === undefined ? {} : { supportsVision: capabilityOverrides.vision }),
                              ...(capabilityOverrides?.structuredOutput === undefined ? {} : { supportsStructuredOutputs: capabilityOverrides.structuredOutput }),
                              ...(capabilityOverrides?.reasoning === undefined ? {} : { supportsReasoning: capabilityOverrides.reasoning }),
                          }),
                      )
                    : (DEFAULT_MODELS[provider] ?? []).map(enrichModelInfo);
            const next = raw;
            setModels(next);
            if (!res.ok || data.error) {
                setError(
                    data.error || `Failed to load models (HTTP ${res.status})`,
                );
                // Keep live ChatGPT account models when discovery returned them;
                // only fall back to static defaults when the list is empty.
                if (!(provider === "chatgpt" && data.models && data.models.length > 0)) {
                    setModels(
                        (DEFAULT_MODELS[provider] ?? []).map(enrichModelInfo),
                    );
                }
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
    }, [enabled, provider, apiKey, baseUrl, compatibleHeaders, timeoutMs, maxRetries, authMode, capabilityOverrides]);

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
    const selected = models.find((model) => model.id === value);
    const { hovered, setHovered, merged } = useHoveredModel();
    const catalog = useModelCatalog();

    useEffect(() => {
        setHovered(null);
    }, [open, setHovered]);

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

    const menuStyle = useAnchoredMenu(open, triggerRef, menuRef, {
        width: 360,
        maxHeight: 320,
        align: "left",
        zIndex: 140,
    });

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    hapticSelect();
                    setOpen((current) => !current);
                }}
                onMouseEnter={() => {
                    if (!open && selected) {
                        setHovered({
                            model: selected,
                            placement: "above",
                            rect: triggerRef.current?.getBoundingClientRect() ?? {
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                            },
                        });
                    }
                }}
                onMouseLeave={() => setHovered(null)}
                className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-input bg-background px-3 text-left text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label="Choose model"
            >
                {selected ? (
                    <ModelLogo
                        provider={selected.provider}
                        modelId={selected.id}
                        size={16}
                    />
                ) : null}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
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
                    <Command className="flex h-full min-h-0 flex-col" label="Choose model">
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
                        <Command.List
                            className="min-h-0 flex-1 overflow-y-auto p-1"
                            onMouseLeave={() => setHovered(null)}
                        >
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
                                        setHovered(null);
                                    }}
                                    onMouseEnter={(event) => {
                                        setHovered({
                                            model,
                                            placement: "side",
                                            rect: (
                                                event.currentTarget as HTMLElement
                                            ).getBoundingClientRect(),
                                        });
                                    }}
                                    onFocus={(event) => {
                                        setHovered({
                                            model,
                                            placement: "side",
                                            rect: (
                                                event.currentTarget as HTMLElement
                                            ).getBoundingClientRect(),
                                        });
                                    }}
                                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs outline-none aria-selected:bg-accent"
                                >
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-1.5 truncate font-medium">
                                            <ModelLogo
                                                provider={model.provider}
                                                modelId={model.id}
                                                size={14}
                                            />
                                            {model.name || model.id}
                                            <ModelBadges
                                                model={model}
                                                catalog={catalog}
                                            />
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

            {hovered && merged && !open ? (
                <ModelHoverCard
                    anchor={hovered.rect}
                    model={merged}
                    placement={hovered.placement}
                />
            ) : null}
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
    const { hovered, setHovered, merged } = useHoveredModel();
    const catalog = useModelCatalog();

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
        if (!open) {
            setHovered(null);
            return;
        }
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
    }, [open, setHovered]);

    const menuStyle = useAnchoredMenu(open, triggerRef, menuRef, {
        width: 352,
        maxHeight: 320,
        align,
        zIndex: 140,
    });

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
                onMouseEnter={() => {
                    if (!open && selected) {
                        setHovered({
                            model: selected,
                            placement: "above",
                            rect: triggerRef.current?.getBoundingClientRect() ?? {
                                top: 0,
                                bottom: 0,
                                left: 0,
                                right: 0,
                            },
                        });
                    }
                }}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                    "flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-transparent font-medium outline-none transition-colors hover:border-border hover:bg-muted/40",
                    compact
                        ? "h-7 py-0.5 pr-1.5 pl-2 text-[11px]"
                        : "h-8 bg-background py-1 pr-2 pl-2.5 text-xs",
                )}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                {selected ? (
                    <ModelLogo
                        provider={selected.provider}
                        modelId={selected.id}
                        size={compact ? 14 : 16}
                    />
                ) : null}
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
                        className="flex h-full min-h-0 flex-col"
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
                        <Command.List
                            className="min-h-0 flex-1 overflow-y-auto p-1"
                            onMouseLeave={() => setHovered(null)}
                        >
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
                                        setHovered(null);
                                    }}
                                    onMouseEnter={(event) => {
                                        setHovered({
                                            model: m,
                                            placement: "side",
                                            rect: (
                                                event.currentTarget as HTMLElement
                                            ).getBoundingClientRect(),
                                        });
                                    }}
                                    onFocus={(event) => {
                                        setHovered({
                                            model: m,
                                            placement: "side",
                                            rect: (
                                                event.currentTarget as HTMLElement
                                            ).getBoundingClientRect(),
                                        });
                                    }}
                                    className={cn(
                                        "flex cursor-pointer flex-col gap-0.5 rounded-lg px-2.5 py-2 text-xs outline-none aria-selected:bg-accent",
                                        m.id === value && "bg-accent/70",
                                    )}
                                >
                                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                                        <ModelLogo
                                            provider={m.provider}
                                            modelId={m.id}
                                            size={14}
                                        />
                                        {m.name}
                                        <ModelBadges model={m} catalog={catalog} />
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

            {hovered && merged && !open ? (
                <ModelHoverCard
                    anchor={hovered.rect}
                    model={merged}
                    placement={hovered.placement}
                />
            ) : null}
        </div>
    );
}
