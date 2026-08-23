/**
 * Composio apps — BYOK entry point for SaaS integrations.
 *
 * The API key stays in this browser (encrypted settings); a hosted Composio
 * session exposes the user's connected apps to chat over MCP. Free tier
 * covers sessions, managed OAuth, and ~20k tool calls/month.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowClockwise,
    CheckCircle,
    PlugsConnected,
    WarningCircle,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { cn } from "~/lib/utils";

type ToolkitInfo = {
    slug: string;
    name: string;
    logo: string | null;
    connected: boolean;
    connectedAccountId: string | null;
};

type ComposioApiResponse = {
    ok?: boolean;
    error?: string;
    userId?: string;
    sessionId?: string;
    mcpUrl?: string;
    mcpHeaders?: Record<string, string>;
    items?: ToolkitInfo[];
    redirectUrl?: string;
};

const DASHBOARD_KEYS_URL =
    "https://dashboard.composio.dev/~/project/settings/api-keys";

export function ComposioSettings() {
    const { settings, updateSettings } = useSettings();
    const composio = settings.composio;
    const [apiKeyDraft, setApiKeyDraft] = useState(composio.apiKey);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [toolkits, setToolkits] = useState<ToolkitInfo[]>([]);
    const [dropActive, setDropActive] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const pollRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (pollRef.current != null) window.clearInterval(pollRef.current);
    }, []);

    const patchComposio = useCallback(
        (patch: Partial<typeof composio>) => {
            updateSettings({ composio: { ...composio, ...patch } });
        },
        [composio, updateSettings],
    );

    const callApi = useCallback(
        async (payload: Record<string, unknown>): Promise<ComposioApiResponse> => {
            const response = await fetch("/api/composio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiKey: apiKeyDraft.trim() || composio.apiKey,
                    userId: composio.userId || undefined,
                    sessionId: composio.sessionId,
                    ...payload,
                }),
            });
            const data = (await response.json()) as ComposioApiResponse;
            if (!response.ok || data.ok === false) {
                throw new Error(data.error || `Composio request failed (${response.status}).`);
            }
            return data;
        },
        [apiKeyDraft, composio.apiKey, composio.userId, composio.sessionId],
    );

    const refreshToolkits = useCallback(
        async (silent = false) => {
            if (!silent) setBusy("toolkits");
            try {
                const data = await callApi({ action: "toolkits" });
                setToolkits(data.items ?? []);
            } catch (err) {
                if (!silent) setError(err instanceof Error ? err.message : "Could not load apps.");
            } finally {
                if (!silent) setBusy(null);
            }
        },
        [callApi],
    );

    useEffect(() => {
        if (composio.enabled && composio.apiKey && !toolkits.length) {
            void refreshToolkits(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [composio.enabled, composio.apiKey]);

    const handleConnectAccount = useCallback(async () => {
        const key = apiKeyDraft.trim();
        if (!key) {
            setError("Paste your Composio API key first.");
            return;
        }
        setBusy("connect");
        setError(null);
        setNotice(null);
        try {
            await callApi({ action: "test" });
            let mcpUrl: string | null = null;
            let sessionId: string | null = null;
            let mcpHeaders: Record<string, string> = {};
            let userId = composio.userId;
            let readOnly = false;
            try {
                const session = await callApi({ action: "session" });
                mcpUrl = session.mcpUrl ?? null;
                sessionId = session.sessionId ?? null;
                mcpHeaders = session.mcpHeaders ?? {};
                userId = session.userId || composio.userId;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "";
                readOnly = /read-only access|read access/.test(msg);
                if (!readOnly) throw err;
            }
            patchComposio({
                apiKey: key,
                enabled: Boolean(mcpUrl),
                userId,
                sessionId,
                mcpUrl,
                mcpHeaders,
            });
            setNotice(
                readOnly
                    ? "Key saved. This key only has read-only access — browse apps below, but chat needs the key granted \"sessions\" write access."
                    : "Composio is live. Connect an app below, then ask the assistant to use it.",
            );
            const list = await callApi({
                action: "toolkits",
                sessionId,
                userId,
            });
            setToolkits(list.items ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not connect Composio.");
        } finally {
            setBusy(null);
        }
    }, [apiKeyDraft, callApi, composio.userId, patchComposio]);

    const startToolkitAuth = useCallback(
        async (slug: string) => {
            setBusy(`auth-${slug}`);
            setError(null);
            try {
                const data = await callApi({ action: "authorize", toolkit: slug });
                if (!data.redirectUrl) throw new Error("No connect link returned.");
                window.open(
                    data.redirectUrl,
                    "_blank",
                    "noopener,noreferrer,width=640,height=760",
                );
                setNotice(`Complete the ${slug} sign-in in the opened window.`);
                if (pollRef.current != null) window.clearInterval(pollRef.current);
                let attempts = 0;
                pollRef.current = window.setInterval(async () => {
                    attempts += 1;
                    try {
                        const check = await callApi({ action: "toolkits" });
                        const next = check.items ?? [];
                        setToolkits(next);
                        const hit = next.find((t) => t.slug === slug && t.connected);
                        if (hit || attempts > 30) {
                            if (pollRef.current != null) window.clearInterval(pollRef.current);
                            if (hit) setNotice(`${hit.name} connected.`);
                        }
                    } catch {
                        /* keep polling until timeout */
                    }
                }, 2000);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Could not start sign-in.");
            } finally {
                setBusy(null);
            }
        },
        [callApi],
    );

    const disconnectToolkit = useCallback(
        async (toolkit: ToolkitInfo) => {
            setBusy(`disc-${toolkit.slug}`);
            setError(null);
            setNotice(null);
            try {
                await callApi({
                    action: "disconnect",
                    connectedAccountId: toolkit.connectedAccountId,
                    toolkit: toolkit.slug,
                });
                setToolkits((prev) =>
                    prev.map((t) =>
                        t.slug === toolkit.slug
                            ? { ...t, connected: false, connectedAccountId: null }
                            : t,
                    ),
                );
            } catch (err) {
                setError(err instanceof Error ? err.message : "Could not disconnect.");
            } finally {
                setBusy(null);
            }
        },
        [callApi],
    );

    const removeIntegration = useCallback(() => {
        patchComposio({
            enabled: false,
            apiKey: "",
            sessionId: null,
            mcpUrl: null,
            mcpHeaders: {},
        });
        setApiKeyDraft("");
        setToolkits([]);
        setNotice(null);
        setError(null);
    }, [patchComposio]);

    const readFileAsKey = useCallback(async (file: File) => {
        try {
            const text = (await file.text()).trim();
            const match = text.match(/["']?([A-Za-z0-9_\-]{20,})["']?/);
            if (match?.[1]) {
                setApiKeyDraft(match[1]);
                setNotice(`Loaded key from ${file.name}. Press Save & connect.`);
                setError(null);
            } else {
                setError(`${file.name} did not contain a recognizable key.`);
            }
        } catch {
            setError(`Could not read ${file.name}.`);
        }
    }, []);

    const toggleEnabled = useCallback(
        (next: boolean) => {
            patchComposio({ enabled: next && Boolean(composio.mcpUrl) });
        },
        [patchComposio, composio.mcpUrl],
    );

    return (
        <section aria-labelledby="composio-heading" className="space-y-4">
            <div>
                <h2 id="composio-heading" className="flex items-center gap-2 text-sm font-semibold">
                    Composio Apps
                    <span className="rounded-full border border-primary/35 bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                        New
                    </span>
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    Let the assistant act in Gmail, GitHub, Notion, Slack, Linear, and more.
                    Sign-up is free — no credit card, ~20k tool calls/month included.
                    Your API key never leaves this browser except per-request relay.
                </p>
            </div>

            <div className="space-y-2">
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDropActive(true);
                    }}
                    onDragLeave={() => setDropActive(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDropActive(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) void readFileAsKey(file);
                    }}
                    className={cn(
                        "rounded-lg border border-dashed p-3 transition-colors",
                        dropActive ? "border-primary bg-accent" : "border-border",
                    )}
                >
                    <div className="flex gap-2">
                        <Input
                            type={showKey ? "text" : "password"}
                            value={apiKeyDraft}
                            onChange={(e) => setApiKeyDraft(e.target.value)}
                            placeholder="Paste your Composio API key…"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowKey((v) => !v)}
                        >
                            {showKey ? "Hide" : "Show"}
                        </Button>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                        Get a key at{" "}
                        <a
                            href={DASHBOARD_KEYS_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2"
                        >
                            dashboard.composio.dev → API keys
                        </a>{" "}
                        — or drag the key file here.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        disabled={busy === "connect"}
                        onClick={() => void handleConnectAccount()}
                    >
                        {busy === "connect" ? (
                            <Loader2 className="size-4 animate-spin [animation-duration:0.6s]" />
                        ) : composio.mcpUrl ? (
                            <ArrowClockwise className="size-4" />
                        ) : (
                            <PlugsConnected className="size-4" />
                        )}
                        {composio.mcpUrl ? "Re-sync session" : "Save & connect"}
                    </Button>
                    {composio.mcpUrl ? (
                        <>
                            <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12px]">
                                <input
                                    type="checkbox"
                                    checked={composio.enabled}
                                    onChange={(e) => toggleEnabled(e.target.checked)}
                                    className="accent-current"
                                />
                                Use in chat
                            </label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={removeIntegration}
                            >
                                Remove
                            </Button>
                        </>
                    ) : null}
                </div>

                {error ? (
                    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-destructive">
                        <WarningCircle className="mt-0.5 size-3.5 shrink-0" />
                        {error}
                    </p>
                ) : null}
                {notice ? (
                    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        <CheckCircle className="mt-0.5 size-3.5 shrink-0" />
                        {notice}
                    </p>
                ) : null}
            </div>

            {composio.apiKey ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium">Apps</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy === "toolkits"}
                            onClick={() => void refreshToolkits()}
                        >
                            {busy === "toolkits" ? (
                                <Loader2 className="size-4 animate-spin [animation-duration:0.6s]" />
                            ) : (
                                <ArrowClockwise className="size-4" />
                            )}
                            Refresh
                        </Button>
                    </div>
                    {toolkits.length === 0 && busy === "toolkits" ? (
                        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin [animation-duration:0.6s]" />
                            Loading apps…
                        </p>
                    ) : null}
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                        {toolkits.map((toolkit) => (
                            <li
                                key={toolkit.slug}
                                className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"
                            >
                                {toolkit.logo ? (
                                    <img
                                        src={toolkit.logo}
                                        alt=""
                                        width={18}
                                        height={18}
                                        loading="lazy"
                                        className="size-[18px] shrink-0 object-contain"
                                    />
                                ) : (
                                    <span className="flex size-[18px] shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold uppercase">
                                        {toolkit.name.slice(0, 1)}
                                    </span>
                                )}
                                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                                    {toolkit.name}
                                </span>
                                {toolkit.connected ? (
                                    <>
                                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                                            <CheckCircle className="size-3" weight="fill" />
                                            Connected
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-1.5 text-[11px]"
                                            disabled={busy === `disc-${toolkit.slug}`}
                                            onClick={() => void disconnectToolkit(toolkit)}
                                        >
                                            Disconnect
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-[11px]"
                                        disabled={busy === `auth-${toolkit.slug}`}
                                        onClick={() => void startToolkitAuth(toolkit.slug)}
                                    >
                                        {busy === `auth-${toolkit.slug}` ? (
                                            <Loader2 className="size-3.5 animate-spin [animation-duration:0.6s]" />
                                        ) : (
                                            "Connect"
                                        )}
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        In chat, tools appear as{" "}
                        <code className="font-mono">mcp_composio_…</code>. If the assistant hits a
                        locked app, it will share a sign-in link or point you back here.
                        Destructive actions are filtered out by default.
                    </p>
                </div>
            ) : null}
        </section>
    );
}
