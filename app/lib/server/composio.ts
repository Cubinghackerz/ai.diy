/**
 * Composio server relay. The API key arrives per request and is never stored.
 * Catalog and OAuth do not require an MCP session. Sessions exist only so chat
 * can load hosted mcp_composio_* tools.
 */
import { Composio } from "@composio/core";

const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3.1";
const TOOLKIT_PAGE_LIMIT = 100;
const MAX_TOOLKIT_PAGES = 20;
const REQUEST_TIMEOUT_MS = 8_000;
const SESSION_TIMEOUT_MS = 45_000;
const AUTHORIZE_TIMEOUT_MS = 20_000;
const CONNECTIONS_TIMEOUT_MS = 8_000;
const CATALOG_TTL_MS = 30 * 60_000;
const CATALOG_PARTIAL_TTL_MS = 60_000;

export type ComposioToolkitInfo = {
    slug: string;
    name: string;
    logo: string | null;
    connected: boolean;
    connectedAccountId: string | null;
};

export type ComposioSessionInfo = {
    sessionId: string;
    mcpUrl: string;
    mcpHeaders: Record<string, string>;
};

type ToolkitConnection = {
    connected: boolean;
    connectedAccountId: string | null;
};

type CatalogPage = {
    items?: unknown;
    next_cursor?: unknown;
    nextCursor?: unknown;
};

type CatalogCache = {
    items: unknown[];
    expiresAt: number;
    complete: boolean;
};

let catalogCache: CatalogCache | null = null;
let catalogFill: Promise<void> | null = null;

function requestOptions(timeoutMs: number) {
    return { signal: AbortSignal.timeout(timeoutMs) };
}

function getClient(apiKey: string): Composio {
    return new Composio({ apiKey, disableVersionCheck: true, allowTracking: false });
}

async function composioRest(
    apiKey: string,
    path: string,
    init?: { method?: string; body?: unknown; timeoutMs?: number },
): Promise<Response> {
    return fetch(`${COMPOSIO_API_BASE}${path}`, {
        method: init?.method ?? "GET",
        headers: {
            "x-api-key": apiKey,
            Accept: "application/json",
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(init?.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
}

export async function testComposioKey(apiKey: string): Promise<void> {
    const response = await composioRest(apiKey, "/toolkits?limit=1");
    if (!response.ok) {
        throw new Error(
            response.status === 401 || response.status === 403
                ? "Invalid Composio API key."
                : `Composio rejected the key (HTTP ${response.status}).`,
        );
    }
}

async function createSession(apiKey: string, userId: string): Promise<ComposioSessionInfo> {
    const session = await getClient(apiKey).create(
        userId,
        {
            mcp: true,
            tags: { disable: ["destructiveHint"] },
            sandbox: { enable: false },
        },
        requestOptions(SESSION_TIMEOUT_MS),
    );
    if (!session.mcp?.url) {
        throw new Error("Composio did not return an MCP endpoint for this session.");
    }
    return {
        sessionId: session.sessionId,
        mcpUrl: session.mcp.url,
        mcpHeaders: (session.mcp.headers ?? {}) as Record<string, string>,
    };
}

export async function ensureComposioSession(options: {
    apiKey: string;
    userId: string;
    sessionId?: string | null;
    mcpUrl?: string | null;
    mcpHeaders?: Record<string, string>;
}): Promise<ComposioSessionInfo> {
    const { apiKey, userId, sessionId, mcpUrl, mcpHeaders } = options;
    if (sessionId && mcpUrl) {
        return { sessionId, mcpUrl, mcpHeaders: mcpHeaders ?? {} };
    }
    if (sessionId) {
        try {
            const reused = await getClient(apiKey).use(
                sessionId,
                { mcp: true },
                requestOptions(SESSION_TIMEOUT_MS),
            );
            if (reused.mcp?.url) {
                return {
                    sessionId: reused.sessionId ?? sessionId,
                    mcpUrl: reused.mcp.url,
                    mcpHeaders: (reused.mcp.headers ?? {}) as Record<string, string>,
                };
            }
        } catch {
            /* create a replacement below */
        }
    }
    return createSession(apiKey, userId);
}

function rememberCatalog(items: unknown[], complete: boolean): CatalogCache {
    catalogCache = {
        items,
        complete,
        expiresAt: Date.now() + (complete ? CATALOG_TTL_MS : CATALOG_PARTIAL_TTL_MS),
    };
    return catalogCache;
}

async function fetchCatalogPage(
    apiKey: string,
    cursor?: string,
): Promise<{ items: unknown[]; nextCursor?: string }> {
    const query = new URLSearchParams({ limit: String(TOOLKIT_PAGE_LIMIT) });
    if (cursor) query.set("cursor", cursor);
    const response = await composioRest(apiKey, `/toolkits?${query.toString()}`);
    if (!response.ok) {
        throw new Error(`Composio toolkit catalog failed (HTTP ${response.status}).`);
    }
    const payload = (await response.json()) as CatalogPage | unknown[];
    const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.items)
          ? payload.items
          : [];
    const nextCursor = Array.isArray(payload)
        ? undefined
        : typeof payload.next_cursor === "string"
          ? payload.next_cursor
          : typeof payload.nextCursor === "string"
            ? payload.nextCursor
            : undefined;
    return { items, nextCursor };
}

async function fillCatalog(apiKey: string, seed: unknown[], cursor: string): Promise<void> {
    const items = [...seed];
    let next = cursor;
    for (let page = 1; page < MAX_TOOLKIT_PAGES; page += 1) {
        try {
            const result = await fetchCatalogPage(apiKey, next);
            items.push(...result.items);
            if (!result.nextCursor || result.items.length === 0) {
                rememberCatalog(items, true);
                return;
            }
            next = result.nextCursor;
            rememberCatalog(items, false);
        } catch {
            rememberCatalog(items, false);
            return;
        }
    }
    rememberCatalog(items, false);
}

async function listCatalog(apiKey: string): Promise<{ items: unknown[]; complete: boolean }> {
    if (catalogCache && catalogCache.expiresAt > Date.now()) {
        return { items: catalogCache.items, complete: catalogCache.complete };
    }
    const first = await fetchCatalogPage(apiKey);
    const complete = !first.nextCursor || first.items.length === 0;
    const cached = rememberCatalog(first.items, complete);
    if (!complete && first.nextCursor && !catalogFill) {
        catalogFill = fillCatalog(apiKey, first.items, first.nextCursor).finally(() => {
            catalogFill = null;
        });
    }
    return { items: cached.items, complete: cached.complete };
}

async function listConnections(
    apiKey: string,
    userId: string,
): Promise<{ states: Map<string, ToolkitConnection>; known: boolean }> {
    const states = new Map<string, ToolkitConnection>();
    let cursor: string | undefined;
    try {
        const composio = getClient(apiKey);
        for (let page = 0; page < 2; page += 1) {
            const result = await composio.connectedAccounts.list(
                { userIds: [userId], limit: 100, cursor },
                requestOptions(CONNECTIONS_TIMEOUT_MS),
            );
            for (const account of result.items) {
                const slug = account.toolkit?.slug;
                if (typeof slug !== "string" || account.status !== "ACTIVE") continue;
                states.set(slug, { connected: true, connectedAccountId: account.id });
            }
            if (!result.nextCursor) break;
            cursor = result.nextCursor;
        }
        return { states, known: true };
    } catch {
        return { states, known: states.size > 0 };
    }
}

function normalizeToolkits(
    payload: unknown,
    connections: Map<string, ToolkitConnection>,
): ComposioToolkitInfo[] {
    const items = Array.isArray((payload as { items?: unknown })?.items)
        ? (payload as { items: unknown[] }).items
        : Array.isArray(payload)
          ? payload
          : [];
    const result: ComposioToolkitInfo[] = [];
    for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const value = item as { slug?: unknown; name?: unknown; logo?: unknown; meta?: unknown };
        if (typeof value.slug !== "string") continue;
        const meta =
            value.meta && typeof value.meta === "object"
                ? (value.meta as { logo?: unknown })
                : undefined;
        const connection = connections.get(value.slug);
        result.push({
            slug: value.slug,
            name: typeof value.name === "string" ? value.name : value.slug,
            logo:
                typeof value.logo === "string"
                    ? value.logo
                    : typeof meta?.logo === "string"
                      ? meta.logo
                      : `https://logos.composio.dev/api/${value.slug}`,
            connected: connection?.connected === true,
            connectedAccountId: connection?.connectedAccountId ?? null,
        });
    }
    return result.sort((a, b) => {
        if (a.connected !== b.connected) return a.connected ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

export async function listComposioToolkits(options: {
    apiKey: string;
    sessionId?: string | null;
    userId: string;
}): Promise<{
    items: ComposioToolkitInfo[];
    hasSession: boolean;
    catalogComplete: boolean;
    connectionsKnown: boolean;
}> {
    const [catalog, connections] = await Promise.all([
        listCatalog(options.apiKey),
        listConnections(options.apiKey, options.userId),
    ]);
    return {
        items: normalizeToolkits(catalog.items, connections.states),
        hasSession: Boolean(options.sessionId),
        catalogComplete: catalog.complete,
        connectionsKnown: connections.known,
    };
}

export async function authorizeComposioToolkit(options: {
    apiKey: string;
    userId: string;
    toolkit: string;
}): Promise<string> {
    const request = await getClient(options.apiKey).toolkits.authorize(
        options.userId,
        options.toolkit,
        undefined,
        requestOptions(AUTHORIZE_TIMEOUT_MS),
    );
    if (!request.redirectUrl) {
        throw new Error(`Composio did not return a connect link for ${options.toolkit}.`);
    }
    return request.redirectUrl;
}

function accountIdFromItem(item: { id?: unknown; nanoid?: unknown } | undefined): string {
    if (typeof item?.id === "string" && item.id) return item.id;
    if (typeof item?.nanoid === "string" && item.nanoid) return item.nanoid;
    return "";
}

async function findConnectedAccountId(options: {
    apiKey: string;
    toolkit?: string;
    userId?: string;
}): Promise<string> {
    if (!options.toolkit) return "";
    const composio = getClient(options.apiKey);
    const queries = [
        {
            toolkitSlugs: [options.toolkit],
            userIds: options.userId ? [options.userId] : undefined,
            statuses: ["ACTIVE"] as Array<"ACTIVE">,
            limit: 10,
        },
        {
            toolkitSlugs: [options.toolkit],
            userIds: options.userId ? [options.userId] : undefined,
            limit: 10,
        },
        {
            toolkitSlugs: [options.toolkit],
            limit: 10,
        },
    ];
    for (const query of queries) {
        try {
            const listed = await composio.connectedAccounts.list(
                query,
                requestOptions(REQUEST_TIMEOUT_MS),
            );
            const active = listed.items.find((item) => item.status === "ACTIVE");
            const accountId = accountIdFromItem(active ?? listed.items[0]);
            if (accountId) return accountId;
        } catch {
            /* try the next query shape */
        }
    }
    return "";
}

function isConnectedAccountsWriteDenied(error: unknown): boolean {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    return /connected_accounts/.test(raw) && /InsufficientPermissions|read access|write access/i.test(raw);
}

export async function disconnectComposioToolkit(options: {
    apiKey: string;
    connectedAccountId?: string | null;
    toolkit?: string;
    userId?: string;
}): Promise<void> {
    const composio = getClient(options.apiKey);
    let accountId = options.connectedAccountId?.trim() || "";
    if (!accountId) {
        accountId = await findConnectedAccountId(options);
    }
    if (!accountId) {
        throw new Error("No connected account found to disconnect.");
    }
    try {
        await composio.connectedAccounts.delete(accountId, requestOptions(REQUEST_TIMEOUT_MS));
        return;
    } catch (error) {
        if (isConnectedAccountsWriteDenied(error)) {
            throw new Error(
                "This Composio key can list apps but cannot disconnect them. In dashboard.composio.dev, edit the key and grant connected_accounts write access.",
            );
        }
        try {
            await composio.connectedAccounts.disable(accountId, requestOptions(REQUEST_TIMEOUT_MS));
        } catch (disableError) {
            if (isConnectedAccountsWriteDenied(disableError)) {
                throw new Error(
                    "This Composio key can list apps but cannot disconnect them. In dashboard.composio.dev, edit the key and grant connected_accounts write access.",
                );
            }
            throw error;
        }
    }
}
