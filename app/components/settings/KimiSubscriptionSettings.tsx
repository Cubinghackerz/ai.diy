import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { useSettings } from "~/lib/providers/SettingsProvider";

type KimiSession = {
    status: "authenticated" | "unauthenticated" | "expired" | "loading";
};

export function useKimiSession() {
    const [session, setSession] = useState<KimiSession>({
        status: "loading",
    });

    const refresh = useCallback(async (): Promise<KimiSession> => {
        try {
            const response = await fetch("/api/kimi/session", {
                credentials: "include",
                cache: "no-store",
            });
            const data = (await response.json()) as {
                status?: KimiSession["status"];
            };
            const next: KimiSession = {
                status:
                    data.status === "authenticated" ||
                    data.status === "expired" ||
                    data.status === "loading"
                        ? data.status
                        : "unauthenticated",
            };
            setSession(next);
            return next;
        } catch {
            const next = { status: "unauthenticated" as const };
            setSession(next);
            return next;
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { session, refresh };
}

export function KimiSubscriptionSettings({
    onConnected,
}: {
    onConnected?: () => void;
} = {}) {
    const { updateProvider, updateSettings } = useSettings();
    const { session, refresh } = useKimiSession();
    const [loginPending, setLoginPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const notifiedRef = useRef(false);

    const stopPolling = useCallback(() => {
        if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
        }
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setLoginPending(false);
    }, []);

    useEffect(() => () => stopPolling(), [stopPolling]);

    useEffect(() => {
        if (session.status === "authenticated") {
            stopPolling();
            updateSettings({ kimiLoginEnabled: true });
            updateProvider("kimi", {
                apiKey: "",
                baseUrl: "",
                enabled: true,
            });
            if (!notifiedRef.current) {
                notifiedRef.current = true;
                onConnected?.();
            }
            return;
        }
        if (session.status === "expired") {
            updateSettings({ kimiLoginEnabled: false });
            updateProvider("kimi", { apiKey: "", enabled: false });
        }
        notifiedRef.current = false;
    }, [onConnected, session.status, stopPolling, updateProvider, updateSettings]);

    const startLogin = useCallback(() => {
        setError(null);
        updateSettings({ kimiLoginEnabled: true });
        const popup = window.open(
            "/api/kimi/login",
            "kimi-code-login",
            "popup=yes,width=480,height=720,resizable=yes,scrollbars=yes",
        );
        if (!popup) {
            setError("Allow popups for this site, then try Kimi sign-in again.");
            return;
        }

        stopPolling();
        const poll = window.setInterval(() => {
            void refresh().then((next) => {
                if (next.status === "authenticated") stopPolling();
            });
        }, 1000);
        pollRef.current = poll;
        timeoutRef.current = window.setTimeout(() => {
            stopPolling();
            setError("Kimi sign-in timed out. You can try again.");
        }, 5 * 60 * 1000);
        setLoginPending(true);
    }, [refresh, stopPolling, updateSettings]);

    const disconnect = useCallback(async () => {
        stopPolling();
        await fetch("/api/kimi/logout", {
            method: "POST",
            credentials: "include",
        }).catch(() => undefined);
        notifiedRef.current = false;
        updateSettings({ kimiLoginEnabled: false });
        updateProvider("kimi", { apiKey: "", baseUrl: "", enabled: false });
        await refresh();
    }, [refresh, stopPolling, updateProvider, updateSettings]);

    const connected = session.status === "authenticated";

    return (
        <section className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-medium">Kimi membership</p>
                        <span className="rounded-full border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
                            Experimental
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Sign in with your Kimi Code membership. Requests use the official
                        coding API, not a Moonshot Open Platform key.
                    </p>
                </div>
                {connected ? (
                    <CheckCircle
                        size={17}
                        weight="fill"
                        className="shrink-0 text-success"
                        aria-label="Kimi connected"
                    />
                ) : (
                    <WarningCircle
                        size={17}
                        weight="fill"
                        className="shrink-0 text-amber-500"
                        aria-label="Kimi not connected"
                    />
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {connected ? (
                    <>
                        <span className="font-mono text-[10px] text-success">
                            Connected to Kimi
                        </span>
                        <Button type="button" size="sm" variant="ghost" onClick={disconnect}>
                            Disconnect
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loginPending}
                        onClick={startLogin}
                    >
                        {loginPending ? "Waiting for Kimi…" : "Sign in with Kimi"}
                    </Button>
                )}
            </div>

            {error ? (
                <p className="mt-2 text-[11px] leading-relaxed text-destructive">{error}</p>
            ) : null}
        </section>
    );
}