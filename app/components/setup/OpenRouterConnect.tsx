import { useEffect, useRef, useState } from "react";
import { LoaderIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
    OpenRouterOAuthError,
    completeOpenRouterSignIn,
    readOpenRouterCode,
    startOpenRouterSignIn,
} from "~/lib/openrouter-oauth.client";
import {
    useSettingsActions,
    useSettingsGetter,
    useSettingsLoaded,
} from "~/lib/providers/SettingsProvider";
import { isProviderReady } from "~/lib/setup";
import { DEFAULT_MODELS } from "~/lib/types";
import { cn } from "~/lib/utils";

const PREFERRED_OPENROUTER_MODEL = "openai/gpt-5";

/** The user's last OpenRouter model, else a strong default that the catalog still lists. */
function defaultOpenRouterModel(lastUsed?: string): string {
    if (lastUsed?.trim()) return lastUsed;
    const pool = DEFAULT_MODELS.openrouter ?? [];
    return (
        pool.find((item) => item.id === PREFERRED_OPENROUTER_MODEL)?.id ??
        pool[0]?.id ??
        "openrouter/auto"
    );
}

/** Sends the user to openrouter.ai to approve ai.diy; the key comes back to this browser. */
export function OpenRouterConnectButton({
    className,
    children = "Continue with OpenRouter",
    variant = "outline",
}: {
    className?: string;
    children?: React.ReactNode;
    variant?: "outline" | "default" | "ghost";
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <div className="flex flex-col gap-1.5">
            <Button
                type="button"
                variant={variant}
                disabled={busy}
                className={className}
                onClick={() => {
                    setBusy(true);
                    setError(null);
                    startOpenRouterSignIn().catch((failure: unknown) => {
                        setBusy(false);
                        setError(
                            failure instanceof OpenRouterOAuthError
                                ? failure.message
                                : "Couldn't start the OpenRouter sign-in. Paste an API key instead.",
                        );
                    });
                }}
            >
                {busy ? <LoaderIcon className="size-3.5 animate-spin" /> : null}
                {children}
            </Button>
            {error ? (
                <p role="alert" className="text-xs leading-relaxed text-red-400">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

/**
 * Finishes an OpenRouter sign-in when the browser comes back from openrouter.ai
 * with `?code=`. Mounted on the workspace route, above the setup gate, so it works
 * on first run and from Settings alike.
 */
export function OpenRouterReturn() {
    const loaded = useSettingsLoaded();
    const { updateProvider, updateChat, updateSettings } = useSettingsActions();
    const getSettings = useSettingsGetter();
    const handled = useRef(false);
    const [status, setStatus] = useState<
        { state: "idle" } | { state: "working" } | { state: "error"; message: string }
    >({ state: "idle" });

    useEffect(() => {
        if (!loaded || handled.current) return;
        const code = readOpenRouterCode(window.location.search);
        if (!code) return;
        handled.current = true;
        // The code is single use; keep it out of the address bar and history right away.
        window.history.replaceState(null, "", window.location.pathname);
        setStatus({ state: "working" });
        completeOpenRouterSignIn(code)
            .then((key) => {
                const before = getSettings();
                // From first run (or with nothing usable selected) make OpenRouter the
                // active provider; from Settings just save the key.
                const activate = !before.setupComplete || !isProviderReady(before);
                updateProvider("openrouter", { apiKey: key, enabled: true });
                if (activate) {
                    const model = defaultOpenRouterModel(
                        before.chat.lastModelsByProvider?.openrouter,
                    );
                    updateChat({ provider: "openrouter", model });
                    updateSettings({ setupComplete: true });
                }
                setStatus({ state: "idle" });
            })
            .catch((failure: unknown) => {
                setStatus({
                    state: "error",
                    message:
                        failure instanceof OpenRouterOAuthError
                            ? failure.message
                            : "The OpenRouter sign-in didn't finish. Try again.",
                });
            });
    }, [loaded, getSettings, updateChat, updateProvider, updateSettings]);

    if (status.state === "idle") return null;
    return (
        <div
            role={status.state === "error" ? "alert" : "status"}
            className={cn(
                "fixed inset-x-0 bottom-4 z-[200] mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl",
                status.state === "error"
                    ? "border-red-500/30 bg-red-950/90 text-red-100"
                    : "border-white/15 bg-zinc-950/90 text-zinc-100",
            )}
        >
            {status.state === "working" ? (
                <>
                    <LoaderIcon className="size-4 animate-spin" />
                    Finishing your OpenRouter sign-in…
                </>
            ) : (
                <>
                    <span>{status.message}</span>
                    <button
                        type="button"
                        onClick={() => setStatus({ state: "idle" })}
                        className="rounded-md px-1.5 text-xs underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        Dismiss
                    </button>
                </>
            )}
        </div>
    );
}
