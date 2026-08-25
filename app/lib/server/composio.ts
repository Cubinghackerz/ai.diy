/**
 * Composio server relay. The API key arrives per request and is never stored.
 * Catalog and OAuth do not require an MCP session. Sessions exist only so chat
 * can load hosted mcp_composio_* tools.
 */
import { Composio } from "@composio/core";
import { createHash } from "node:crypto";

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

const catalogCaches = new Map<string, CatalogCache>();
const catalogFills = new Map<string, Promise<void>>();
const authConfigResolutions = new Map<string, Promise<string>>();
const connectionLinkRequests = new Map<string, Promise<string>>();

function requestOptions(timeoutMs: number) {
    return { signal: AbortSignal.timeout(timeoutMs) };
}

function getClient(apiKey: string): Composio {
    return new Composio({ apiKey, disableVersionCheck: true, allowTracking: false });
}

function apiKeyFingerprint(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
}

export function composioErrorMetadata(error: unknown): {
    status?: number;
    requestId?: string;
} {
    const queue: unknown[] = [error];
    const seen = new Set<unknown>();
    let status: number | undefined;
    let requestId: string | undefined;
    for (let depth = 0; queue.length > 0 && depth < 12; depth += 1) {
        const current = queue.shift();
        if (!current || typeof current !== "object" || seen.has(current)) continue;
        seen.add(current);
        const record = current as Record<string, unknown>;
        const currentStatus = [record.status, record.statusCode].find(
            (value): value is number => typeof value === "number",
        );
        status = status ?? currentStatus;
        const directRequestId = record.requestId ?? record.request_id;
        if (typeof directRequestId === "string" && directRequestId) {
            requestId = directRequestId;
        }
        const headers = record.headers as { get?: (name: string) => string | null } | undefined;
        requestId = requestId ?? headers?.get?.("x-request-id") ?? undefined;
        queue.push(record.cause, record.error);
    }
    return { status, requestId };
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

function composioResponseError(response: Response, message: string): Error {
    return Object.assign(new Error(message), {
        status: response.status,
        requestId: response.headers.get("x-request-id") ?? undefined,
    });
}

async function assertComposioSessionOwner(
    apiKey: string,
    sessionId: string,
    userId: string,
): Promise<void> {
    const response = await composioRest(
        apiKey,
        `/tool_router/session/${encodeURIComponent(sessionId)}`,
        { timeoutMs: SESSION_TIMEOUT_MS },
    );
    if (!response.ok) {
        throw composioResponseError(
            response,
            `Composio session lookup failed (HTTP ${response.status}).`,
        );
    }
    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        throw composioResponseError(response, "Composio returned an invalid session response.");
    }
    const owner =
        payload && typeof payload === "object"
            ? (payload as { config?: { user_id?: unknown } }).config?.user_id
            : undefined;
    if (typeof owner !== "string" || owner !== userId) {
        throw Object.assign(
            new Error("This Composio session belongs to a different user."),
            {
                status: 403,
                requestId: response.headers.get("x-request-id") ?? undefined,
            },
        );
    }
}

export async function testComposioKey(apiKey: string): Promise<void> {
    const response = await composioRest(apiKey, "/toolkits?limit=1");
    if (!response.ok) {
        throw composioResponseError(
            response,
            response.status === 401
                ? "Invalid Composio API key."
                : response.status === 403
                  ? "Composio accepted the key, but it cannot read this project's toolkits."
                  : `Composio rejected the key (HTTP ${response.status}).`,
        );
    }
}

async function createSession(apiKey: string, userId: string): Promise<ComposioSessionInfo> {
    const session = await getClient(apiKey).create(
        userId,
        {
            mcp: true,
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
}): Promise<ComposioSessionInfo> {
    const { apiKey, userId, sessionId } = options;
    if (sessionId) {
        try {
            await assertComposioSessionOwner(apiKey, sessionId, userId);
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
        } catch (error) {
            // Replace only sessions Composio confirms are gone. Authentication,
            // permission, rate-limit, timeout, and upstream errors must surface.
            if (composioErrorMetadata(error).status !== 404) throw error;
        }
    }
    return createSession(apiKey, userId);
}

export async function deleteComposioSession(options: {
    apiKey: string;
    sessionId: string;
    userId: string;
}): Promise<void> {
    try {
        await assertComposioSessionOwner(options.apiKey, options.sessionId, options.userId);
        await getClient(options.apiKey).sessions.delete(
            options.sessionId,
            requestOptions(REQUEST_TIMEOUT_MS),
        );
    } catch (error) {
        // Local removal is idempotent: an expired/deleted session is already safe.
        if (composioErrorMetadata(error).status !== 404) throw error;
    }
}

function rememberCatalog(
    cacheKey: string,
    items: unknown[],
    complete: boolean,
): CatalogCache {
    const cache = {
        items,
        complete,
        expiresAt: Date.now() + (complete ? CATALOG_TTL_MS : CATALOG_PARTIAL_TTL_MS),
    };
    catalogCaches.set(cacheKey, cache);
    for (const [key, value] of catalogCaches) {
        if (value.expiresAt <= Date.now()) catalogCaches.delete(key);
    }
    while (catalogCaches.size > 20) {
        const oldest = catalogCaches.keys().next().value;
        if (typeof oldest !== "string") break;
        catalogCaches.delete(oldest);
    }
    return cache;
}

async function fetchCatalogPage(
    apiKey: string,
    cursor?: string,
): Promise<{ items: unknown[]; nextCursor?: string }> {
    const query = new URLSearchParams({ limit: String(TOOLKIT_PAGE_LIMIT) });
    if (cursor) query.set("cursor", cursor);
    const response = await composioRest(apiKey, `/toolkits?${query.toString()}`);
    if (!response.ok) {
        throw composioResponseError(
            response,
            `Composio toolkit catalog failed (HTTP ${response.status}).`,
        );
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

async function fillCatalog(
    apiKey: string,
    cacheKey: string,
    seed: unknown[],
    cursor: string,
): Promise<void> {
    const items = [...seed];
    let next = cursor;
    for (let page = 1; page < MAX_TOOLKIT_PAGES; page += 1) {
        try {
            const result = await fetchCatalogPage(apiKey, next);
            items.push(...result.items);
            if (!result.nextCursor || result.items.length === 0) {
                rememberCatalog(cacheKey, items, true);
                return;
            }
            next = result.nextCursor;
            rememberCatalog(cacheKey, items, false);
        } catch {
            rememberCatalog(cacheKey, items, false);
            return;
        }
    }
    rememberCatalog(cacheKey, items, false);
}

async function listCatalog(apiKey: string): Promise<{ items: unknown[]; complete: boolean }> {
    const cacheKey = apiKeyFingerprint(apiKey);
    const catalogCache = catalogCaches.get(cacheKey);
    if (catalogCache && catalogCache.expiresAt > Date.now()) {
        return { items: catalogCache.items, complete: catalogCache.complete };
    }
    const first = await fetchCatalogPage(apiKey);
    const complete = !first.nextCursor || first.items.length === 0;
    const cached = rememberCatalog(cacheKey, first.items, complete);
    if (!complete && first.nextCursor && !catalogFills.has(cacheKey)) {
        const fill = fillCatalog(apiKey, cacheKey, first.items, first.nextCursor).finally(() => {
            catalogFills.delete(cacheKey);
        });
        catalogFills.set(cacheKey, fill);
    }
    return { items: cached.items, complete: cached.complete };
}

async function listConnections(
    apiKey: string,
    userId: string,
): Promise<{ states: Map<string, ToolkitConnection>; known: boolean }> {
    const states = new Map<string, ToolkitConnection>();
    let cursor: string | undefined;
    const composio = getClient(apiKey);
    for (let page = 0; page < MAX_TOOLKIT_PAGES; page += 1) {
        const result = await composio.connectedAccounts.list(
            { userIds: [userId], limit: 100, cursor },
            requestOptions(CONNECTIONS_TIMEOUT_MS),
        );
        for (const account of result.items) {
            const slug = account.toolkit?.slug;
            if (
                typeof slug !== "string" ||
                account.status !== "ACTIVE" ||
                states.has(slug)
            ) {
                continue;
            }
            states.set(slug, { connected: true, connectedAccountId: account.id });
        }
        if (!result.nextCursor) return { states, known: true };
        cursor = result.nextCursor;
    }
    return { states, known: false };
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
            logo: `https://logos.composio.dev/api/${encodeURIComponent(value.slug)}`,
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
        listConnections(options.apiKey, options.userId).catch(() => ({
            states: new Map<string, ToolkitConnection>(),
            known: false,
        })),
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
    const requestKey = `${apiKeyFingerprint(options.apiKey)}:${options.userId}:${options.toolkit}`;
    const existing = connectionLinkRequests.get(requestKey);
    if (existing) return existing;

    const pending = authorizeComposioToolkitOnce(options);
    connectionLinkRequests.set(requestKey, pending);
    try {
        return await pending;
    } finally {
        connectionLinkRequests.delete(requestKey);
    }
}

async function authorizeComposioToolkitOnce(options: {
    apiKey: string;
    userId: string;
    toolkit: string;
}): Promise<string> {
    const composio = getClient(options.apiKey);
    const authConfigId = await resolveAuthConfigIdOnce(
        composio,
        options.apiKey,
        options.toolkit,
    );
    const request = await composio.connectedAccounts.link(
        options.userId,
        authConfigId,
        { allowMultiple: false },
        requestOptions(AUTHORIZE_TIMEOUT_MS),
    );
    if (!request.redirectUrl) {
        throw new Error(`Composio did not return a connect link for ${options.toolkit}.`);
    }
    return request.redirectUrl;
}

async function resolveAuthConfigIdOnce(
    composio: Composio,
    apiKey: string,
    toolkit: string,
): Promise<string> {
    const key = `${apiKeyFingerprint(apiKey)}:${toolkit}`;
    const existing = authConfigResolutions.get(key);
    if (existing) return existing;
    const pending = resolveAuthConfigId(composio, toolkit);
    authConfigResolutions.set(key, pending);
    try {
        return await pending;
    } finally {
        authConfigResolutions.delete(key);
    }
}

async function resolveAuthConfigId(
    composio: Composio,
    toolkit: string,
): Promise<string> {
    const managedConfigs = await composio.authConfigs.list(
        { toolkit, isComposioManaged: true, limit: 20 },
        requestOptions(AUTHORIZE_TIMEOUT_MS),
    );
    const enabledManaged = managedConfigs.items.find(
        (config) => config.status === "ENABLED",
    );
    if (enabledManaged?.id) return enabledManaged.id;

    // Projects can use a custom OAuth config, so preserve that path if no
    // managed config is available for the toolkit.
    const allConfigs = await composio.authConfigs.list(
        { toolkit, limit: 20 },
        requestOptions(AUTHORIZE_TIMEOUT_MS),
    );
    const enabledConfig = allConfigs.items.find(
        (config) => config.status === "ENABLED",
    );
    if (enabledConfig?.id) return enabledConfig.id;

    const toolkitInfo = await composio.toolkits.get(
        toolkit,
        requestOptions(AUTHORIZE_TIMEOUT_MS),
    );
    if (!toolkitInfo.authConfigDetails?.length) {
        throw new Error(`No auth config found for Composio toolkit ${toolkit}.`);
    }

    const created = await composio.authConfigs.create(
        toolkit,
        {
            type: "use_composio_managed_auth",
            name: `${toolkitInfo.name} Auth Config`,
        },
        requestOptions(AUTHORIZE_TIMEOUT_MS),
    );
    if (!created.id) {
        throw new Error(`Composio did not return an auth config for ${toolkit}.`);
    }
    return created.id;
}

function accountIdFromItem(item: { id?: unknown; nanoid?: unknown } | undefined): string {
    if (typeof item?.id === "string" && item.id) return item.id;
    if (typeof item?.nanoid === "string" && item.nanoid) return item.nanoid;
    return "";
}

async function findConnectedAccountId(options: {
    apiKey: string;
    toolkit: string;
    userId: string;
    requestedId?: string;
}): Promise<string> {
    const composio = getClient(options.apiKey);
    let cursor: string | undefined;
    for (let page = 0; page < MAX_TOOLKIT_PAGES; page += 1) {
        const listed = await composio.connectedAccounts.list(
            {
                toolkitSlugs: [options.toolkit],
                userIds: [options.userId],
                statuses: ["ACTIVE"],
                limit: 100,
                cursor,
            },
            requestOptions(REQUEST_TIMEOUT_MS),
        );
        const match = options.requestedId
            ? listed.items.find((item) => accountIdFromItem(item) === options.requestedId)
            : listed.items[0];
        const accountId = accountIdFromItem(match);
        if (accountId) return accountId;
        if (!listed.nextCursor) break;
        cursor = listed.nextCursor;
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
    toolkit: string;
    userId: string;
}): Promise<void> {
    const composio = getClient(options.apiKey);
    const requestedId = options.connectedAccountId?.trim() || undefined;
    const accountId = await findConnectedAccountId({ ...options, requestedId });
    if (!accountId) {
        throw Object.assign(
            new Error("No matching connected account found for this user and toolkit."),
            { status: 404 },
        );
    }
    try {
        await composio.connectedAccounts.delete(accountId, requestOptions(REQUEST_TIMEOUT_MS));
    } catch (error) {
        if (isConnectedAccountsWriteDenied(error)) {
            throw Object.assign(
                new Error(
                    "This Composio key can list apps but cannot disconnect them. In dashboard.composio.dev, grant connected_accounts write access.",
                    { cause: error },
                ),
                { ...composioErrorMetadata(error), status: 403 },
            );
        }
        throw error;
    }
}
