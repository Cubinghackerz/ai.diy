/**
 * Composio integration — server relay.
 *
 * The user's COMPOSIO_API_KEY arrives per request from the browser and is
 * never persisted server-side. Sessions expose the user's connected SaaS apps
 * through Composio's hosted MCP endpoint, which the chat pipeline loads like
 * any other remote MCP server (`mcp_composio_*` tools).
 *
 * Free tier notes: sessions + managed OAuth + MCP are included on Composio's
 * free plan (hard cap ~20k tool calls/month), so no paid plan is required.
 */
import { Composio } from "@composio/core";

const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3.1";

/** Curated default toolkit scope keeps discovery tight and budget-friendly. */
export const COMPOSIO_TOOLKIT_ALLOWLIST = [
    "github",
    "gmail",
    "googlecalendar",
    "googledrive",
    "googlesheets",
    "slack",
    "notion",
    "linear",
    "jira",
    "discord",
    "trello",
    "airtable",
    "youtube",
    "hackernews",
    "todoist",
    "twitter",
] as const;

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

function getComposioClient(apiKey: string): Composio {
    return new Composio({ apiKey });
}

async function composioRest(
    apiKey: string,
    path: string,
    init?: { method?: string; body?: unknown },
): Promise<Response> {
    return fetch(`${COMPOSIO_API_BASE}${path}`, {
        method: init?.method ?? "GET",
        headers: {
            "x-api-key": apiKey,
            Accept: "application/json",
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(15_000),
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

async function createComposioSession(
    apiKey: string,
    userId: string,
): Promise<ComposioSessionInfo> {
    const composio = getComposioClient(apiKey);
    const session = await composio.create(userId, {
        mcp: true,
        tags: { disable: ["destructiveHint"] },
        sandbox: { enable: false },
    });
    if (!session.mcp?.url) {
        throw new Error("Composio did not return an MCP endpoint for this session.");
    }
    return {
        sessionId: session.sessionId,
        mcpUrl: session.mcp.url,
        mcpHeaders: (session.mcp.headers ?? {}) as Record<string, string>,
    };
}

/** Reuse the stored session when possible; otherwise create a fresh one. */
export async function ensureComposioSession(options: {
    apiKey: string;
    userId: string;
    sessionId?: string | null;
}): Promise<ComposioSessionInfo> {
    const { apiKey, userId, sessionId } = options;
    if (sessionId) {
        try {
            const composio = getComposioClient(apiKey);
            const reused = await composio.use(sessionId, { mcp: true });
            if (reused.mcp?.url) {
                return {
                    sessionId: reused.sessionId ?? sessionId,
                    mcpUrl: reused.mcp.url,
                    mcpHeaders: (reused.mcp.headers ?? {}) as Record<string, string>,
                };
            }
        } catch {
            // Fall through and create a replacement session.
        }
    }
    return createComposioSession(apiKey, userId);
}

function normalizeToolkits(payload: unknown): ComposioToolkitInfo[] {
    const items = Array.isArray((payload as { items?: unknown })?.items)
        ? ((payload as { items: unknown[] }).items)
        : Array.isArray(payload)
          ? payload
          : [];
    const result: ComposioToolkitInfo[] = [];
    for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const value = item as {
            slug?: unknown;
            name?: unknown;
            logo?: unknown;
            connection?: unknown;
        };
        if (typeof value.slug !== "string") continue;
        const connection =
            value.connection && typeof value.connection === "object"
                ? (value.connection as {
                      is_active?: unknown;
                      isActive?: unknown;
                      connected_account?: unknown;
                      connectedAccount?: unknown;
                  })
                : undefined;
        const account =
            connection?.connected_account && typeof connection.connected_account === "object"
                ? (connection.connected_account as { id?: unknown; nanoid?: unknown })
                : connection?.connectedAccount &&
                    typeof connection.connectedAccount === "object"
                  ? (connection.connectedAccount as { id?: unknown; nanoid?: unknown })
                  : undefined;
        const accountId =
            (typeof account?.id === "string" && account.id) ||
            (typeof account?.nanoid === "string" && account.nanoid) ||
            null;
        const active =
            connection?.is_active === true ||
            connection?.isActive === true ||
            Boolean(accountId);
        result.push({
            slug: value.slug,
            name: typeof value.name === "string" ? value.name : value.slug,
            logo: typeof value.logo === "string"
                ? value.logo
                : `https://logos.composio.dev/api/${value.slug}`,
            connected: active,
            connectedAccountId: accountId,
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
}): Promise<{ items: ComposioToolkitInfo[]; hasSession: boolean }> {
    const { apiKey, sessionId, userId } = options;
    if (sessionId) {
        try {
            const composio = getComposioClient(apiKey);
            const session = await composio.use(sessionId);
            const toolkits = await session.toolkits({
                toolkits: [...COMPOSIO_TOOLKIT_ALLOWLIST],
                limit: 50,
            });
            return { items: normalizeToolkits(toolkits), hasSession: true };
        } catch {
            // Session unusable — fall back to catalog view without status.
        }
    }
    const composio = getComposioClient(apiKey);
    const catalog = await composio.toolkits.get({});
    const items = Array.isArray(catalog) ? catalog : [];
    const allowed = new Set<string>(COMPOSIO_TOOLKIT_ALLOWLIST);
    const catalogView: ComposioToolkitInfo[] = [];
    for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const value = item as {
            slug?: unknown;
            name?: unknown;
            meta?: unknown;
        };
        if (typeof value.slug !== "string" || !allowed.has(value.slug)) continue;
        const meta =
            value.meta && typeof value.meta === "object"
                ? (value.meta as { logo?: unknown })
                : undefined;
        catalogView.push({
            slug: value.slug,
            name: typeof value.name === "string" ? value.name : value.slug,
            logo:
                typeof meta?.logo === "string"
                    ? meta.logo
                    : `https://logos.composio.dev/api/${value.slug}`,
            connected: false,
            connectedAccountId: null,
        });
    }
    return { items: catalogView, hasSession: false };
}

export async function authorizeComposioToolkit(options: {
    apiKey: string;
    sessionId?: string | null;
    userId: string;
    toolkit: string;
}): Promise<string> {
    const { apiKey, sessionId, userId, toolkit } = options;
    let sessionIdResolved = sessionId ?? null;
    if (!sessionIdResolved) {
        const created = await createComposioSession(apiKey, userId);
        sessionIdResolved = created.sessionId;
    }
    const composio = getComposioClient(apiKey);
    const session = await composio.use(sessionIdResolved);
    const request = await session.authorize(toolkit);
    if (!request?.redirectUrl) {
        throw new Error(`Composio did not return a connect link for ${toolkit}.`);
    }
    return request.redirectUrl;
}

export async function disconnectComposioToolkit(options: {
    apiKey: string;
    connectedAccountId?: string | null;
    toolkit?: string;
    userId?: string;
}): Promise<void> {
    const composio = getComposioClient(options.apiKey);
    let accountId = options.connectedAccountId?.trim() || "";
    if (!accountId && options.toolkit) {
        const listed = await composio.connectedAccounts.list({
            toolkitSlugs: [options.toolkit],
            userIds: options.userId ? [options.userId] : undefined,
            limit: 10,
        });
        const first = listed.items?.[0] as { id?: unknown; nanoid?: unknown } | undefined;
        accountId =
            (typeof first?.id === "string" && first.id) ||
            (typeof first?.nanoid === "string" && first.nanoid) ||
            "";
    }
    if (!accountId) {
        throw new Error("No connected account found to disconnect.");
    }
    await composio.connectedAccounts.delete(accountId);
}
