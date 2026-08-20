import { CheckCircle } from "@phosphor-icons/react";
import {
    TOOL_ACCESS_OPTIONS,
    normalizeToolAccess,
    type ToolAccessKey,
    type ToolAccessSettings,
} from "~/lib/tool-access";
import { cn } from "~/lib/utils";

export function ToolAccessPicker({
    value,
    onChange,
    dark = false,
}: {
    value: Partial<ToolAccessSettings> | undefined;
    onChange: (key: ToolAccessKey, enabled: boolean) => void;
    dark?: boolean;
}) {
    const access = normalizeToolAccess(value);

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h2 className={cn("text-sm font-semibold", dark && "text-zinc-100")}>
                    Choose AI tool access
                </h2>
                <p
                    className={cn(
                        "mt-1 text-[11px] leading-relaxed text-muted-foreground",
                        dark && "text-zinc-400",
                    )}
                >
                    Only enabled capabilities are registered for the model. You can
                    change this later in Settings → Tools.
                </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="AI tool access">
                {TOOL_ACCESS_OPTIONS.map((option) => {
                    const enabled = access[option.key];
                    return (
                        <button
                            key={option.key}
                            type="button"
                            role="checkbox"
                            aria-checked={enabled}
                            onClick={() => onChange(option.key, !enabled)}
                            className={cn(
                                "flex min-h-[4.1rem] items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                                enabled
                                    ? dark
                                        ? "border-white/20 bg-white/[0.07] hover:bg-white/[0.1]"
                                        : "border-primary/30 bg-primary/[0.06] hover:bg-primary/[0.1]"
                                    : dark
                                      ? "border-white/[0.08] bg-white/[0.02] opacity-75 hover:bg-white/[0.05]"
                                      : "border-border/70 bg-muted/20 opacity-75 hover:bg-muted/40",
                            )}
                        >
                            <span
                                className={cn(
                                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                                    enabled
                                        ? dark
                                            ? "border-emerald-300 bg-emerald-300 text-black"
                                            : "border-primary bg-primary text-primary-foreground"
                                        : dark
                                          ? "border-white/20"
                                          : "border-border",
                                )}
                                aria-hidden
                            >
                                {enabled ? <CheckCircle size={13} weight="fill" /> : null}
                            </span>
                            <span className="min-w-0">
                                <span
                                    className={cn(
                                        "block text-xs font-semibold",
                                        dark && "text-zinc-100",
                                    )}
                                >
                                    {option.label}
                                </span>
                                <span
                                    className={cn(
                                        "mt-0.5 block text-[10px] leading-relaxed text-muted-foreground",
                                        dark && "text-zinc-500",
                                    )}
                                >
                                    {option.description}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
