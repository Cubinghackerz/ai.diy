/**
 * Grok Build OAuth and proxy session.
 *
 * The browser only receives an opaque HttpOnly session cookie. Grok Build's
 * OAuth tokens stay in the encrypted server-side session store and are sent
 * only to the official CLI chat proxy.
 */

import { randomBytes } from "node:crypto";
import {
    readCookie,
    serializeCookie,
} from "@opencoredev/loginwithchatgpt-server";
import type { KeyValueStore } from "@opencoredev/loginwithchatgpt-core";
import { resolveGrokSessionStore } from "~/lib/server/local-persist";

const GROK_BUILD_CLIENT_ID =
    process.env.GROK_BUILD_OAUTH_CLIENT_ID?.trim() ||
    "b1a00492-073a-47ea-816f-4c329264a828";
const GROK_BUILD_ISSUER =
    process.env.GROK_BUILD_OAUTH_ISSUER?.trim() || "https://auth.x.ai";
const GROK_BUILD_PROXY_URL =
    process.env.GROK_BUILD_PROXY_URL?.trim() ||
    "https://cli-chat-proxy.grok.com/v1";
const GROK_BUILD_COOKIE = "grok_build_session";
const GROK_BUILD_PENDING_COOKIE = "grok_build_login";
const GROK_BUILD_MODEL = "grok-build";
const GROK_BUILD_CLIENT_VERSION =
    process.env.GROK_BUILD_CLIENT_VERSION?.trim() || "1.0.6";
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
const GROK_BUILD_SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "grok-cli:access",
    "api:access",
    "conversations:read",
    "conversations:write",
    "workspaces:read",
    "workspaces:write",
].join(" ");

type OAuthState = {
    deviceCode: string;
    expiresAt: number;
    intervalMs: number;
    lastPolledAt?: number;
};

type StoredSession = {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
};

export type GrokBuildSession = {
    status: "authenticated" | "unauthenticated" | "expired" | "loading";
};

let stateStore: KeyValueStore<OAuthState> | undefined;
let sessionStore: KeyValueStore<StoredSession> | undefined;

function getStateStore(): KeyValueStore<OAuthState> {
    return (stateStore ??= resolveGrokSessionStore<OAuthState>(
        "grok-build-oauth-state.json",
    ));
}

function getSessionStore(): KeyValueStore<StoredSession> {
    return (sessionStore ??= resolveGrokSessionStore<StoredSession>(
        "grok-build-sessions.json",
    ));
}

function base64Url(value: Buffer): string {
    return value
        .toString("base64")
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
}

function secureCookie(request: Request) {
    const url = new URL(request.url);
    const forwardedProtocol = request.headers
        .get("x-forwarded-proto")
        ?.split(",", 1)[0]
        ?.trim();
    return url.protocol === "https:" || forwardedProtocol === "https";
}

function cookie(
    name: string,
    value: string,
    request: Request,
    maxAge: number,
): string {
    return serializeCookie(name, value, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: secureCookie(request),
        maxAge,
    });
}

function tokenEndpoint(): string {
    return `${GROK_BUILD_ISSUER}/oauth2/token`;
}

function deviceEndpoint(): string {
    return `${GROK_BUILD_ISSUER}/oauth2/device/code`;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    try {
        const value = (await response.json()) as unknown;
        return value && typeof value === "object"
            ? (value as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

function authWindowResponse(request: Request, status: "authenticated" | "error") {
    const message =
        status === "authenticated"
            ? "Grok Build connected. You can close this window."
            : "Grok Build sign-in could not be completed. You can close this window.";
    const eventStatus = JSON.stringify(status);
    const origin = JSON.stringify(new URL(request.url).origin);
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Grok Build sign-in</title></head>
<body><p>${message}</p><script>
window.opener?.postMessage({source:"prismium:grok-build-auth",status:${eventStatus}},${origin});
window.setTimeout(() => window.close(), 250);
</script></body></html>`;
    return new Response(html, {
        status: status === "authenticated" ? 200 : 400,
        headers: {
            "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'",
            "Content-Type": "text/html; charset=utf-8",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
    });
}

async function refreshStoredSession(
    sessionId: string,
    stored: StoredSession,
): Promise<StoredSession | null> {
    if (stored.expiresAt > Date.now() + ACCESS_TOKEN_REFRESH_MARGIN_MS) {
        return stored;
    }
    if (!stored.refreshToken) {
        await getSessionStore().delete(sessionId);
        return null;
    }

    const response = await fetch(tokenEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: GROK_BUILD_CLIENT_ID,
            refresh_token: stored.refreshToken,
        }),
    });
    const payload = await readJson(response);
    const accessToken =
        typeof payload.access_token === "string" ? payload.access_token : "";
    if (!response.ok || !accessToken) {
        await getSessionStore().delete(sessionId);
        return null;
    }

    const expiresIn =
        typeof payload.expires_in === "number" && payload.expires_in > 0
            ? payload.expires_in
            : 7 * 24 * 60 * 60;
    const next: StoredSession = {
        accessToken,
        refreshToken:
            typeof payload.refresh_token === "string"
                ? payload.refresh_token
                : stored.refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
    };
    await getSessionStore().set(sessionId, next, { ttlMs: SESSION_TTL_MS });
    return next;
}

async function authenticatedRecord(
    request: Request,
): Promise<{ id: string; session: StoredSession } | null> {
    const sessionId = readCookie(request, GROK_BUILD_COOKIE);
    if (!sessionId) return null;
    const stored = await getSessionStore().get(sessionId);
    if (!stored?.accessToken) return null;
    const session = await refreshStoredSession(sessionId, stored);
    return session ? { id: sessionId, session } : null;
}

export async function getGrokBuildSession(
    request: Request,
): Promise<GrokBuildSession> {
    return (await resolveGrokBuildSession(request)).session;
}

export async function startGrokBuildLogin(request: Request): Promise<Response> {
    const response = await fetch(deviceEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: GROK_BUILD_CLIENT_ID,
            scope: GROK_BUILD_SCOPES,
        }),
    });
    const payload = await readJson(response);
    const deviceCode =
        typeof payload.device_code === "string" ? payload.device_code : "";
    const verificationUrl =
        typeof payload.verification_uri_complete === "string"
            ? payload.verification_uri_complete
            : typeof payload.verification_uri === "string"
              ? payload.verification_uri
              : "";
    if (!response.ok || !deviceCode || !verificationUrl) {
        console.error(
            "[grok/oauth] Device authorization failed:",
            typeof payload.error_description === "string"
                ? payload.error_description
                : `HTTP ${response.status}`,
        );
        return new Response("Grok Build authorization is temporarily unavailable.", {
            status: 502,
            headers: { "Cache-Control": "no-store" },
        });
    }

    const state = base64Url(randomBytes(32));
    const expiresIn =
        typeof payload.expires_in === "number" && payload.expires_in > 0
            ? payload.expires_in
            : 30 * 60;
    const intervalSeconds =
        typeof payload.interval === "number" && payload.interval > 0
            ? payload.interval
            : 5;
    await getStateStore().set(
        state,
        {
            deviceCode,
            expiresAt: Date.now() + expiresIn * 1000,
            intervalMs: intervalSeconds * 1000,
        },
        { ttlMs: expiresIn * 1000 },
    );

    const redirect = new Response(null, {
        status: 302,
        headers: {
            Location: verificationUrl,
            "Cache-Control": "no-store",
        },
    });
    redirect.headers.append(
        "Set-Cookie",
        cookie(GROK_BUILD_PENDING_COOKIE, state, request, Math.ceil(expiresIn)),
    );
    return redirect;
}

async function resolveGrokBuildSession(
    request: Request,
): Promise<{ session: GrokBuildSession; sessionId?: string }> {
    const sessionId = readCookie(request, GROK_BUILD_COOKIE);
    if (sessionId) {
        const stored = await getSessionStore().get(sessionId);
        if (stored) {
            const refreshed = await refreshStoredSession(sessionId, stored);
            if (refreshed) return { session: { status: "authenticated" } };
        }
    }

    const pendingId = readCookie(request, GROK_BUILD_PENDING_COOKIE);
    if (!pendingId) return { session: { status: "unauthenticated" } };
    const pending = await getStateStore().get(pendingId);
    if (!pending || pending.expiresAt <= Date.now()) {
        await getStateStore().delete(pendingId);
        return { session: { status: "expired" } };
    }

    const now = Date.now();
    if (pending.lastPolledAt && now - pending.lastPolledAt < pending.intervalMs) {
        return { session: { status: "loading" } };
    }
    await getStateStore().set(
        pendingId,
        { ...pending, lastPolledAt: now },
        { ttlMs: Math.max(1, pending.expiresAt - now) },
    );

    const response = await fetch(tokenEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            client_id: GROK_BUILD_CLIENT_ID,
            device_code: pending.deviceCode,
        }),
    });
    const payload = await readJson(response);
    const accessToken =
        typeof payload.access_token === "string" ? payload.access_token : "";
    if (accessToken) {
        const expiresIn =
            typeof payload.expires_in === "number" && payload.expires_in > 0
                ? payload.expires_in
                : 7 * 24 * 60 * 60;
        const nextSessionId = base64Url(randomBytes(32));
        await getSessionStore().set(
            nextSessionId,
            {
                accessToken,
                refreshToken:
                    typeof payload.refresh_token === "string"
                        ? payload.refresh_token
                        : undefined,
                expiresAt: Date.now() + expiresIn * 1000,
            },
            { ttlMs: SESSION_TTL_MS },
        );
        await getStateStore().delete(pendingId);
        return {
            session: { status: "authenticated" },
            sessionId: nextSessionId,
        };
    }

    const error = typeof payload.error === "string" ? payload.error : "";
    if (error === "expired_token" || error === "invalid_grant") {
        await getStateStore().delete(pendingId);
        return { session: { status: "expired" } };
    }
    return { session: { status: "loading" } };
}

export async function getGrokBuildSessionResponse(
    request: Request,
): Promise<Response> {
    const result = await resolveGrokBuildSession(request);
    const response = Response.json(result.session, {
        headers: {
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
    });
    if (result.sessionId) {
        response.headers.append(
            "Set-Cookie",
            cookie(
                GROK_BUILD_COOKIE,
                result.sessionId,
                request,
                Math.floor(SESSION_TTL_MS / 1000),
            ),
        );
        response.headers.append(
            "Set-Cookie",
            cookie(GROK_BUILD_PENDING_COOKIE, "", request, 0),
        );
    }
    return response;
}

export async function completeGrokBuildLogin(request: Request): Promise<Response> {
    // The device flow completes through /api/grok/session; this route remains a
    // safe landing page for old bookmarks and previously issued callbacks.
    return authWindowResponse(request, "error");
}

export async function logoutGrokBuild(request: Request): Promise<Response> {
    const sessionId = readCookie(request, GROK_BUILD_COOKIE);
    if (sessionId) await getSessionStore().delete(sessionId);
    const response = new Response(null, {
        status: 204,
        headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": cookie(GROK_BUILD_COOKIE, "", request, 0),
        },
    });
    response.headers.append(
        "Set-Cookie",
        cookie(GROK_BUILD_PENDING_COOKIE, "", request, 0),
    );
    return response;
}

export async function grokBuildAccessToken(request: Request): Promise<string> {
    const record = await authenticatedRecord(request);
    if (!record) {
        throw new Error("Sign in with Grok Build under Settings before using this provider.");
    }
    return record.session.accessToken;
}

/** Fetch implementation for the OpenAI-compatible Grok Build chat proxy. */
export function grokBuildProxyFetch(
    request: Request,
    model = GROK_BUILD_MODEL,
): typeof fetch {
    return async (input, init) => {
        const token = await grokBuildAccessToken(request);
        const headers = new Headers(
            input instanceof Request ? input.headers : undefined,
        );
        new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
        headers.set("Authorization", `Bearer ${token}`);
        headers.set("X-XAI-Token-Auth", "xai-grok-cli");
        headers.set("x-grok-model-override", model);
        headers.set("x-grok-client-version", GROK_BUILD_CLIENT_VERSION);
        return fetch(input, { ...init, headers });
    };
}

export async function listGrokBuildModels(
    request: Request,
): Promise<Array<{ id: string; name: string }>> {
    const modelsUrl = `${GROK_BUILD_PROXY_URL.replace(/\/+$/, "")}/models`;
    const response = await grokBuildProxyFetch(request)(modelsUrl, {
        headers: { Accept: "application/json" },
    });
    const payload = await readJson(response);
    if (!response.ok) {
        throw new Error(
            typeof payload.error === "string"
                ? payload.error
                : `Grok Build models request failed (HTTP ${response.status})`,
        );
    }
    const data = Array.isArray(payload.data) ? payload.data : [];
    return data
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const value = item as { id?: unknown; name?: unknown };
            if (typeof value.id !== "string" || !value.id.trim()) return null;
            return {
                id: value.id,
                name:
                    typeof value.name === "string" && value.name.trim()
                        ? value.name
                        : value.id,
            };
        })
        .filter((item): item is { id: string; name: string } => item !== null)
        .sort((a, b) => a.id.localeCompare(b.id));
}

export function grokBuildProxyUrl(): string {
    return GROK_BUILD_PROXY_URL;
}

export function grokBuildModel(): string {
    return GROK_BUILD_MODEL;
}
