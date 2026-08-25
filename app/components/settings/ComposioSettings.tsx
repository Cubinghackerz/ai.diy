/**
 * Composio apps — BYOK entry point for SaaS integrations.
 *
 * Key validation and app OAuth are independent of the chat MCP session.
 * The session is created in the background so browsing and Connect stay fast.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowClockwise,
    CheckCircle,
    MagnifyingGlass,
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
    catalogComplete?: boolean;
    connectionsKnown?: boolean;
    redirectUrl?: string;
    code?: string;
    requestId?: string;
};

const DASHBOARD_KEYS_URL =
    "https://dashboard.composio.dev/~/project/settings/api-keys";
const CATALOG_CACHE_KEY = "aidiy.composio.catalog.v3";

const FEATURED_APPS: ToolkitInfo[] = [
    { slug: "facebook", name: "Facebook", logo: "https://logos.composio.dev/api/facebook", connected: false, connectedAccountId: null },
    { slug: "instagram", name: "Instagram", logo: "https://logos.composio.dev/api/instagram", connected: false, connectedAccountId: null },
    { slug: "youtube", name: "YouTube", logo: "https://logos.composio.dev/api/youtube", connected: false, connectedAccountId: null },
    { slug: "gmail", name: "Gmail", logo: "https://logos.composio.dev/api/gmail", connected: false, connectedAccountId: null },
    { slug: "github", name: "GitHub", logo: "https://logos.composio.dev/api/github", connected: false, connectedAccountId: null },
    { slug: "slack", name: "Slack", logo: "https://logos.composio.dev/api/slack", connected: false, connectedAccountId: null },
    { slug: "notion", name: "Notion", logo: "https://logos.composio.dev/api/notion", connected: false, connectedAccountId: null },
    { slug: "linear", name: "Linear", logo: "https://logos.composio.dev/api/linear", connected: false, connectedAccountId: null },
];

const BROWSE_DESTINATIONS = [
    {
        id: "facebook",
        label: "Facebook",
        query: "facebook",
        aliases: ["facebook", "facebookpages", "facebookpage"],
        webOnly: false,
    },
    {
        id: "instagram",
        label: "Instagram",
        query: "instagram",
        aliases: ["instagram", "instagrambusiness", "instagramcreator"],
        webOnly: false,
    },
    {
        id: "youtube",
        label: "YouTube",
        query: "youtube",
        aliases: ["youtube"],
        webOnly: false,
    },
    {
        id: "marketplace",
        label: "Marketplace",
        query: "marketplace",
        aliases: [] as string[],
        webOnly: true,
    },
] as const;

async function catalogStorageKey(apiKey: string): Promise<string | null> {
    if (!apiKey || typeof window === "undefined") return null;
    try {
        const digest = await window.crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(apiKey),
        );
        const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
        ).join("");
        return `${CATALOG_CACHE_KEY}.${fingerprint}`;
    } catch {
        return null;
    }
}

function readCachedCatalog(storageKey: string): { items: ToolkitInfo[]; complete: boolean } {
    try {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return { items: [], complete: false };
        const parsed = JSON.parse(raw) as { items?: ToolkitInfo[]; complete?: boolean };
        return {
            items: Array.isArray(parsed.items)
                ? parsed.items.map((item) => ({
                      ...item,
                      connected: false,
                      connectedAccountId: null,
                  }))
                : [],
            complete: parsed.complete === true,
        };
    } catch {
        return { items: [], complete: false };
    }
}

async function writeCachedCatalog(apiKey: string, items: ToolkitInfo[], complete: boolean) {
    const storageKey = await catalogStorageKey(apiKey);
    if (!storageKey) return;
    try {
        const catalogOnly = items.map((item) => ({
            ...item,
            connected: false,
            connectedAccountId: null,
        }));
        sessionStorage.setItem(
            storageKey,
            JSON.stringify({ items: catalogOnly, complete }),
        );
    } catch {
        /* ignore quota */
    }
}

function clearCachedCatalog() {
    try {
        for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
            const key = sessionStorage.key(index);
            if (key?.startsWith(`${CATALOG_CACHE_KEY}.`)) {
                sessionStorage.removeItem(key);
            }
        }
    } catch {
        /* ignore */
    }
}

function normalizeToolkitText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function mergeToolkits(
    incoming: ToolkitInfo[],
    previous: ToolkitInfo[],
    connectionsKnown: boolean,
): ToolkitInfo[] {
    if (connectionsKnown || previous.length === 0) return incoming;
    const prevBySlug = new Map(previous.map((item) => [item.slug, item]));
    return incoming.map((item) => {
        const prev = prevBySlug.get(item.slug);
        if (!item.connected && prev?.connected) {
            return {
                ...item,
                connected: true,
                connectedAccountId: prev.connectedAccountId,
            };
        }
        return item;
    });
}

function openAuthWindow(): Window | null {
    const popup = window.open("about:blank", "composio-oauth", "width=640,height=760");
    if (popup) {
        try {
            popup.opener = null;
        } catch {
            /* ignore */
        }
    }
    return popup;
}

export function ComposioSettings() {
    const { settings, updateSettings } = useSettings();
    const composio = settings.composio;
    const [apiKeyDraft, setApiKeyDraft] = useState(composio.apiKey);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [oauthLink, setOauthLink] = useState<string | null>(null);
    const [toolkits, setToolkits] = useState<ToolkitInfo[]>(FEATURED_APPS);
    const [catalogComplete, setCatalogComplete] = useState(false);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [dropActive, setDropActive] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [appSearch, setAppSearch] = useState("");

    const toolkitsRef = useRef(toolkits);
    toolkitsRef.current = toolkits;
    const pollRef = useRef<number | null>(null);
    const catalogPollRef = useRef<number | null>(null);
    const toolkitRequestRef = useRef<{
        id: number;
        key: string;
        generation: number;
    } | null>(null);
    const toolkitRequestSequenceRef = useRef(0);
    const integrationGenerationRef = useRef(0);
    const oauthAttemptRef = useRef(0);
    const mountedRef = useRef(true);
    const previousApiKeyRef = useRef(composio.apiKey);
    const composioRef = useRef(composio);
    composioRef.current = composio;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            integrationGenerationRef.current += 1;
            toolkitRequestSequenceRef.current += 1;
            toolkitRequestRef.current = null;
            oauthAttemptRef.current += 1;
            if (pollRef.current != null) window.clearInterval(pollRef.current);
            if (catalogPollRef.current != null) window.clearInterval(catalogPollRef.current);
            pollRef.current = null;
            catalogPollRef.current = null;
        };
    }, []);

    useEffect(() => {
        setApiKeyDraft(composio.apiKey);
    }, [composio.apiKey]);

    const patchComposio = useCallback(
        (patch: Partial<typeof composio>) => {
            const next = { ...composioRef.current, ...patch };
            composioRef.current = next;
            updateSettings({ composio: next });
        },
        [updateSettings],
    );

    const callApi = useCallback(async (
        payload: Record<string, unknown>,
        options: { apiKey?: string } = {},
    ): Promise<ComposioApiResponse> => {
        const current = composioRef.current;
        const response = await fetch("/api/composio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                apiKey: options.apiKey ?? current.apiKey,
                userId: current.userId || undefined,
                sessionId: current.sessionId,
                ...payload,
            }),
        });
        let data: ComposioApiResponse = {};
        try {
            data = (await response.json()) as ComposioApiResponse;
        } catch {
            throw new Error(`Composio request failed (${response.status}).`);
        }
        if (!response.ok || data.ok === false) {
            const requestHint = data.requestId ? ` (Composio request ${data.requestId})` : "";
            throw Object.assign(new Error(
                `${data.error || `Composio request failed (${response.status}).`}${requestHint}`,
            ), {
                code: data.code,
                status: response.status,
                requestId: data.requestId,
            });
        }
        return data;
    }, []);

    const applyToolkitPayload = useCallback((
        data: ComposioApiResponse,
        requestedKey: string,
    ) => {
        const items = data.items ?? [];
        if (items.length === 0) return items;
        const next = mergeToolkits(
            items,
            toolkitsRef.current,
            data.connectionsKnown !== false,
        );
        toolkitsRef.current = next;
        setToolkits(next);
        void writeCachedCatalog(requestedKey, next, data.catalogComplete === true);
        setCatalogComplete(data.catalogComplete === true);
        if (data.catalogComplete === true) setCatalogLoading(false);
        if (data.userId && data.userId !== composioRef.current.userId) {
            patchComposio({ userId: data.userId });
        }
        return next;
    }, [patchComposio]);

    const refreshToolkits = useCallback(
        async (silent = false): Promise<ToolkitInfo[] | undefined> => {
            const requestedKey = composioRef.current.apiKey;
            const requestedGeneration = integrationGenerationRef.current;
            if (!requestedKey) return;
            const pending = toolkitRequestRef.current;
            if (
                pending?.key === requestedKey &&
                pending.generation === requestedGeneration
            ) {
                return;
            }
            const requestId = ++toolkitRequestSequenceRef.current;
            toolkitRequestRef.current = {
                id: requestId,
                key: requestedKey,
                generation: requestedGeneration,
            };
            if (!silent) setBusy("toolkits");
            try {
                const data = await callApi({ action: "toolkits" });
                if (
                    requestId !== toolkitRequestSequenceRef.current ||
                    requestedGeneration !== integrationGenerationRef.current ||
                    requestedKey !== composioRef.current.apiKey
                ) {
                    return;
                }
                return applyToolkitPayload(data, requestedKey);
            } catch (err) {
                if (
                    !silent &&
                    requestId === toolkitRequestSequenceRef.current &&
                    requestedGeneration === integrationGenerationRef.current
                ) {
                    setError(err instanceof Error ? err.message : "Could not load apps.");
                }
            } finally {
                if (toolkitRequestRef.current?.id === requestId) {
                    toolkitRequestRef.current = null;
                }
                if (
                    !silent &&
                    requestId === toolkitRequestSequenceRef.current &&
                    requestedGeneration === integrationGenerationRef.current
                ) {
                    setBusy(null);
                }
            }
        },
        [applyToolkitPayload, callApi],
    );

    useEffect(() => {
        const keyChanged = previousApiKeyRef.current !== composio.apiKey;
        previousApiKeyRef.current = composio.apiKey;
        if (keyChanged) {
            toolkitRequestSequenceRef.current += 1;
            toolkitRequestRef.current = null;
            toolkitsRef.current = FEATURED_APPS;
            setToolkits(FEATURED_APPS);
            setCatalogComplete(false);
        }
        if (!composio.apiKey) {
            setCatalogLoading(false);
            return;
        }
        setCatalogLoading(!catalogComplete);
        let cancelled = false;
        void (async () => {
            const storageKey = await catalogStorageKey(composio.apiKey);
            if (cancelled || composioRef.current.apiKey !== composio.apiKey) return;
            if (storageKey) {
                const cached = readCachedCatalog(storageKey);
                if (cached.items.length > 0) {
                    toolkitsRef.current = cached.items;
                    setToolkits(cached.items);
                    setCatalogComplete(cached.complete);
                    setCatalogLoading(!cached.complete);
                }
            }
            if (!cancelled) {
                void refreshToolkits(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [composio.apiKey, refreshToolkits]);

    useEffect(() => {
        if (!composio.apiKey || catalogComplete) {
            if (catalogPollRef.current != null) {
                window.clearInterval(catalogPollRef.current);
                catalogPollRef.current = null;
            }
            setCatalogLoading(false);
            return;
        }
        if (catalogPollRef.current != null) return;
        setCatalogLoading(true);
        let attempts = 0;
        catalogPollRef.current = window.setInterval(() => {
            attempts += 1;
            if (attempts > 8) {
                if (catalogPollRef.current != null) {
                    window.clearInterval(catalogPollRef.current);
                    catalogPollRef.current = null;
                }
                setCatalogLoading(false);
                return;
            }
            void refreshToolkits(true);
        }, 4000);
        return () => {
            if (catalogPollRef.current != null) {
                window.clearInterval(catalogPollRef.current);
                catalogPollRef.current = null;
            }
        };
    }, [catalogComplete, composio.apiKey, refreshToolkits]);

    const startSessionInBackground = useCallback(async (generation: number) => {
        const current = composioRef.current;
        const requestedKey = current.apiKey;
        try {
            const session = await callApi({
                action: "session",
                userId: current.userId || undefined,
            });
            if (
                generation !== integrationGenerationRef.current ||
                requestedKey !== composioRef.current.apiKey
            ) {
                if (
                    session.sessionId &&
                    composioRef.current.sessionId !== session.sessionId
                ) {
                    void callApi(
                        {
                            action: "remove",
                            sessionId: session.sessionId,
                            userId: current.userId || undefined,
                        },
                        { apiKey: requestedKey },
                    ).catch(() => undefined);
                }
                return;
            }
            const latest = composioRef.current;
            const preserveEnabled = Boolean(latest.mcpUrl);
            patchComposio({
                enabled: Boolean(session.mcpUrl) &&
                    (preserveEnabled ? latest.enabled : true),
                userId: session.userId || latest.userId || current.userId,
                sessionId: session.sessionId ?? null,
                mcpUrl: session.mcpUrl ?? null,
                mcpHeaders: session.mcpHeaders ?? {},
            });
            setNotice("Composio is live. Connect an app below, then ask the assistant to use it.");
        } catch (err) {
            if (generation !== integrationGenerationRef.current) return;
            const msg = err instanceof Error ? err.message : "";
            const code =
                err && typeof err === "object" && "code" in err
                    ? (err as { code?: unknown }).code
                    : undefined;
            if (
                code === "composio_insufficient_permissions" ||
                /cannot create sessions|read-only access|read access/i.test(msg)
            ) {
                setNotice(
                    "Key saved. This key only has read-only access — browse apps below, but chat needs the key granted \"sessions\" write access.",
                );
                return;
            }
            setError(
                /did not respond|timeout/i.test(msg)
                    ? "Apps are ready. Chat session is still starting — use Re-sync session if tools do not appear."
                    : msg || "Could not start the Composio chat session.",
            );
        }
    }, [callApi, patchComposio]);

    const handleConnectAccount = useCallback(async () => {
        const key = apiKeyDraft.trim();
        if (!key) {
            setError("Paste your Composio API key first.");
            return;
        }
        const userId =
            composioRef.current.userId || `aidiy-${crypto.randomUUID().slice(0, 12)}`;
        const generation = ++integrationGenerationRef.current;
        setBusy("connect");
        setError(null);
        setOauthLink(null);
        setNotice("Checking key…");
        try {
            const tested = await callApi(
                { action: "test", userId },
                { apiKey: key },
            );
            if (generation !== integrationGenerationRef.current) return;
            const resolvedUserId = tested.userId || userId;
            const previous = composioRef.current;
            const keyChanged = key !== previous.apiKey;
            patchComposio({
                apiKey: key,
                userId: resolvedUserId,
                ...(keyChanged
                    ? {
                          enabled: false,
                          sessionId: null,
                          mcpUrl: null,
                          mcpHeaders: {},
                          autoApproveWrites: false,
                      }
                    : {}),
            });
            if (keyChanged) {
                clearCachedCatalog();
                toolkitsRef.current = FEATURED_APPS;
                setToolkits(FEATURED_APPS);
                setCatalogComplete(false);
                toolkitRequestSequenceRef.current += 1;
                toolkitRequestRef.current = null;
                oauthAttemptRef.current += 1;
                if (pollRef.current != null) window.clearInterval(pollRef.current);
                pollRef.current = null;
                if (previous.apiKey && previous.sessionId) {
                    void callApi(
                        {
                            action: "remove",
                            sessionId: previous.sessionId,
                            userId: previous.userId || undefined,
                        },
                        { apiKey: previous.apiKey },
                    ).catch((err) => {
                        if (
                            mountedRef.current &&
                            generation === integrationGenerationRef.current
                        ) {
                            setNotice(
                                `New key saved, but the previous remote session could not be revoked: ${err instanceof Error ? err.message : "unknown error"}`,
                            );
                        }
                    });
                }
            }
            setNotice("Key saved. Loading apps…");
            setCatalogLoading(true);
            void refreshToolkits(true);
            void startSessionInBackground(generation);
        } catch (err) {
            if (generation !== integrationGenerationRef.current) return;
            setError(err instanceof Error ? err.message : "Could not connect Composio.");
        } finally {
            if (generation === integrationGenerationRef.current) setBusy(null);
        }
    }, [apiKeyDraft, callApi, patchComposio, refreshToolkits, startSessionInBackground]);

    const startToolkitAuth = useCallback(
        async (slug: string) => {
            const generation = integrationGenerationRef.current;
            const requestedKey = composioRef.current.apiKey;
            const attempt = ++oauthAttemptRef.current;
            setBusy(`auth-${slug}`);
            setError(null);
            setOauthLink(null);
            if (pollRef.current != null) window.clearInterval(pollRef.current);
            pollRef.current = null;
            const authWindow = openAuthWindow();
            try {
                const data = await callApi({ action: "authorize", toolkit: slug });
                if (
                    attempt !== oauthAttemptRef.current ||
                    generation !== integrationGenerationRef.current ||
                    requestedKey !== composioRef.current.apiKey
                ) {
                    authWindow?.close();
                    return;
                }
                if (data.userId && data.userId !== composioRef.current.userId) {
                    patchComposio({ userId: data.userId });
                }
                if (!data.redirectUrl) throw new Error("No connect link returned.");
                if (authWindow && !authWindow.closed) {
                    authWindow.location.href = data.redirectUrl;
                    setNotice(`Complete the ${slug} sign-in in the opened window.`);
                } else {
                    authWindow?.close();
                    setOauthLink(data.redirectUrl);
                    setNotice("Popup blocked. Use the sign-in link below.");
                }
                let attempts = 0;
                let pollId: number | null = null;
                const stopPoll = () => {
                    if (pollId != null) window.clearInterval(pollId);
                    if (pollRef.current === pollId) pollRef.current = null;
                };
                pollId = window.setInterval(async () => {
                    if (
                        attempt !== oauthAttemptRef.current ||
                        generation !== integrationGenerationRef.current ||
                        requestedKey !== composioRef.current.apiKey
                    ) {
                        stopPoll();
                        return;
                    }
                    attempts += 1;
                    const next = await refreshToolkits(true);
                    if (
                        attempt !== oauthAttemptRef.current ||
                        generation !== integrationGenerationRef.current ||
                        requestedKey !== composioRef.current.apiKey
                    ) {
                        stopPoll();
                        return;
                    }
                    const hit = next?.find((toolkit) => toolkit.slug === slug && toolkit.connected);
                    if (hit || attempts >= 20) {
                        stopPoll();
                        if (hit) {
                            setNotice(`${hit.name} connected.`);
                            setOauthLink(null);
                        } else {
                            setNotice("Sign-in is still pending. Reopen the app sign-in link and try again.");
                        }
                    }
                }, 3000);
                pollRef.current = pollId;
            } catch (err) {
                authWindow?.close();
                if (
                    attempt === oauthAttemptRef.current &&
                    generation === integrationGenerationRef.current
                ) {
                    setError(err instanceof Error ? err.message : "Could not start sign-in.");
                }
            } finally {
                if (
                    attempt === oauthAttemptRef.current &&
                    generation === integrationGenerationRef.current
                ) {
                    setBusy(null);
                }
            }
        },
        [callApi, patchComposio, refreshToolkits],
    );

    const disconnectToolkit = useCallback(
        async (toolkit: ToolkitInfo) => {
            const generation = integrationGenerationRef.current;
            const requestedKey = composioRef.current.apiKey;
            setBusy(`disc-${toolkit.slug}`);
            setError(null);
            setNotice(null);
            try {
                await callApi({
                    action: "disconnect",
                    connectedAccountId: toolkit.connectedAccountId,
                    toolkit: toolkit.slug,
                });
                if (
                    generation !== integrationGenerationRef.current ||
                    requestedKey !== composioRef.current.apiKey
                ) {
                    return;
                }
                const next = toolkitsRef.current.map((item) =>
                    item.slug === toolkit.slug
                        ? { ...item, connected: false, connectedAccountId: null }
                        : item,
                );
                toolkitsRef.current = next;
                setToolkits(next);
                void writeCachedCatalog(requestedKey, next, catalogComplete);
                setNotice(`${toolkit.name} disconnected.`);
                void refreshToolkits(true);
            } catch (err) {
                if (generation === integrationGenerationRef.current) {
                    setError(err instanceof Error ? err.message : "Could not disconnect.");
                }
            } finally {
                if (generation === integrationGenerationRef.current) setBusy(null);
            }
        },
        [callApi, catalogComplete, refreshToolkits],
    );

    const removeIntegration = useCallback(async () => {
        const current = composioRef.current;
        const generation = ++integrationGenerationRef.current;
        toolkitRequestSequenceRef.current += 1;
        toolkitRequestRef.current = null;
        oauthAttemptRef.current += 1;
        if (pollRef.current != null) window.clearInterval(pollRef.current);
        if (catalogPollRef.current != null) window.clearInterval(catalogPollRef.current);
        pollRef.current = null;
        catalogPollRef.current = null;
        setBusy("remove");
        setError(null);
        setNotice(null);
        patchComposio({
            enabled: false,
            apiKey: "",
            userId: current.userId,
            sessionId: null,
            mcpUrl: null,
            mcpHeaders: {},
            autoApproveWrites: false,
        });
        setApiKeyDraft("");
        toolkitsRef.current = FEATURED_APPS;
        setToolkits(FEATURED_APPS);
        setCatalogComplete(false);
        setCatalogLoading(false);
        setOauthLink(null);
        clearCachedCatalog();
        let remoteError: unknown = null;
        if (current.apiKey && current.sessionId) {
            try {
                await callApi(
                    {
                        action: "remove",
                        sessionId: current.sessionId,
                        userId: current.userId || undefined,
                    },
                    { apiKey: current.apiKey },
                );
            } catch (err) {
                remoteError = err;
            }
        }
        if (
            !mountedRef.current ||
            generation !== integrationGenerationRef.current
        ) {
            return;
        }
        setNotice(
            remoteError
                ? `Composio access removed. The remote session could not be revoked: ${remoteError instanceof Error ? remoteError.message : "unknown error"}`
                : "Composio access removed.",
        );
        setBusy(null);
    }, [callApi, patchComposio]);

    const readFileAsKey = useCallback(async (file: File) => {
        try {
            const text = (await file.text()).trim();
            if (!mountedRef.current) return;
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

    const normalizedAppSearch = appSearch.trim().toLowerCase();
    const hasUnsavedKey = apiKeyDraft.trim() !== composio.apiKey;
    const visibleToolkits = normalizedAppSearch
        ? toolkits.filter(
              (toolkit) =>
                  toolkit.name.toLowerCase().includes(normalizedAppSearch) ||
                  toolkit.slug.toLowerCase().includes(normalizedAppSearch),
          )
        : toolkits;

    const browseToolkits = BROWSE_DESTINATIONS.map((destination) => ({
        destination,
        toolkit: destination.webOnly
            ? undefined
            : toolkits.find((toolkit) => {
                  const slug = normalizeToolkitText(toolkit.slug);
                  const name = normalizeToolkitText(toolkit.name);
                  return destination.aliases.some(
                      (alias) => slug === alias || name === alias || slug.includes(alias),
                  );
              }),
    }));

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
                        if (busy !== null) return;
                        e.preventDefault();
                        setDropActive(true);
                    }}
                    onDragLeave={() => setDropActive(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDropActive(false);
                        if (busy !== null) return;
                        const file = e.dataTransfer.files?.[0];
                        if (file) void readFileAsKey(file);
                    }}
                    className={cn(
                        "rounded-lg border border-dashed p-3 transition-colors",
                        dropActive ? "border-primary bg-accent" : "border-border",
                    )}
                >
                    <div className="flex gap-2">
                        <label htmlFor="composio-api-key" className="sr-only">
                            Composio API key
                        </label>
                        <Input
                            id="composio-api-key"
                            type={showKey ? "text" : "password"}
                            value={apiKeyDraft}
                            onChange={(e) => setApiKeyDraft(e.target.value)}
                            placeholder="Paste your Composio API key…"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={busy !== null}
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
                    <div className="mt-2">
                        <input
                            id="composio-key-file"
                            type="file"
                            accept=".txt,.json,.env,text/plain,application/json"
                            className="sr-only"
                            disabled={busy !== null}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) void readFileAsKey(file);
                            }}
                        />
                        <label
                            htmlFor="composio-key-file"
                            className={cn(
                                "inline-flex cursor-pointer rounded-md border border-border/70 px-2 py-1 text-[11px] font-medium hover:bg-accent",
                                busy !== null && "pointer-events-none opacity-50",
                            )}
                        >
                            Import key file
                        </label>
                    </div>
                    {hasUnsavedKey && composio.apiKey ? (
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                            Unsaved key change. Save it before managing apps.
                        </p>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        disabled={busy !== null}
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
                            <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12px]">
                                <input
                                    type="checkbox"
                                    checked={!composio.autoApproveWrites}
                                    onChange={(event) =>
                                        patchComposio({ autoApproveWrites: !event.target.checked })
                                    }
                                    className="accent-current"
                                />
                                Confirm writes
                            </label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy !== null}
                                onClick={() => void removeIntegration()}
                            >
                                Remove
                            </Button>
                        </>
                    ) : null}
                    {composio.apiKey && !composio.mcpUrl ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void removeIntegration()}
                        >
                            Remove
                        </Button>
                    ) : null}
                </div>

                {error ? (
                    <p role="alert" className="flex items-start gap-1.5 text-[11px] leading-relaxed text-destructive">
                        <WarningCircle className="mt-0.5 size-3.5 shrink-0" />
                        {error}
                    </p>
                ) : null}
                {notice ? (
                    <p role="status" aria-live="polite" className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        <CheckCircle className="mt-0.5 size-3.5 shrink-0" />
                        {notice}
                    </p>
                ) : null}
                {oauthLink ? (
                    <a
                        href={oauthLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-[11px] underline underline-offset-2"
                    >
                        Open sign-in window
                    </a>
                ) : null}
            </div>

            {composio.apiKey ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium">
                            Apps
                            {toolkits.length > 0 ? (
                                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                                    {toolkits.length}
                                </span>
                            ) : null}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={hasUnsavedKey || busy === "toolkits"}
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
                    {toolkits.length > 0 ? (
                        <div className="relative">
                            <MagnifyingGlass
                                aria-hidden="true"
                                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                            />
                            <Input
                                value={appSearch}
                                onChange={(event) => setAppSearch(event.target.value)}
                                placeholder="Search all Composio apps…"
                                aria-label="Search all Composio apps"
                                className="h-8 pl-8 text-[12px]"
                            />
                        </div>
                    ) : null}
                    {toolkits.length > 0 ? (
                        <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-2.5">
                            <p className="text-[11px] font-medium">Browse destinations</p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                                Connect an account for private app content. Marketplace has no
                                Composio connector, so public listings use Web research.
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                                {browseToolkits.map(({ destination, toolkit }) => {
                                    const state = destination.webOnly
                                        ? "Web research"
                                        : toolkit?.connected
                                          ? "Connected"
                                          : toolkit
                                            ? "Connect"
                                            : "Search app";
                                    return (
                                        <button
                                            key={destination.id}
                                            type="button"
                                            onClick={() => {
                                                setError(null);
                                                if (destination.webOnly) {
                                                    setAppSearch("");
                                                    setNotice(
                                                        "Marketplace uses Web research for public listings; private or sign-in-only listings are not supported.",
                                                    );
                                                    return;
                                                }
                                                setAppSearch(destination.query);
                                                setNotice(
                                                    toolkit
                                                        ? `Showing ${toolkit.name}.`
                                                        : `Searching the catalog for ${destination.label}.`,
                                                );
                                            }}
                                            className="rounded-md border border-border/70 bg-background/50 px-2 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                                        >
                                            <span className="block truncate text-[11px] font-medium">
                                                {destination.label}
                                            </span>
                                            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                                {state}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                    {catalogLoading ? (
                        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin [animation-duration:0.6s]" />
                            Loading all apps…
                        </p>
                    ) : null}
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                        {visibleToolkits.map((toolkit) => (
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
                                        referrerPolicy="no-referrer"
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
                                            disabled={
                                                hasUnsavedKey ||
                                                busy === `disc-${toolkit.slug}`
                                            }
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
                                        disabled={
                                            hasUnsavedKey ||
                                            busy?.startsWith("auth-") === true
                                        }
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
                    {toolkits.length > 0 && visibleToolkits.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                            No apps match “{appSearch}”.
                        </p>
                    ) : null}
                    {toolkits.length > 0 && normalizedAppSearch ? (
                        <p className="text-[11px] text-muted-foreground">
                            Showing {visibleToolkits.length} of {toolkits.length} apps.
                        </p>
                    ) : null}
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
