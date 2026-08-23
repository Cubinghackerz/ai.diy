/**
 * Kimi Code membership OAuth (device authorization) and chat proxy session.
 * Tokens stay in the encrypted server-side store; the browser only sees an
 * HttpOnly cookie.
 */

import { randomBytes } from "node:crypto";
import {
    readCookie,
    serializeCookie,
} from "@opencoredev/loginwithchatgpt-server";
import type { KeyValueStore } from "@opencoredev/loginwithchatgpt-core";
import { resolveNamedSessionStore } from "~/lib/server/local-persist";

const KIMI_CLIENT_ID =
    process.env.KIMI_OAUTH_CLIENT_ID?.trim() ||
    "17e5f671-d194-4dfb-9706-5516cb48c098";
const KIMI_OAUTH_HOST =
    process.env.KIMI_OAUTH_HOST?.trim() || "https://auth.kimi.com";
const KIMI_PROXY_URL =
    process.env.KIMI_PROXY_URL?.trim() || "https://api.kimi.com/coding/v1";
const KIMI_COOKIE = "kimi_code_session";
const KIMI_PENDING_COOKIE = "kimi_code_login";
const KIMI_CLIENT_VERSION =
    process.env.KIMI_CLIENT_VERSION?.trim() || "1.0.0";
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

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

export type KimiSession = {
    status: "authenticated" | "unauthenticated" | "expired" | "loading";
};

let stateStore: KeyValueStore<OAuthState> | undefined;
let sessionStore: KeyValueStore<StoredSession> | undefined;

function getStateStore(): KeyValueStore<OAuthState> {
    return (stateStore ??= resolveNamedSessionStore<OAuthState>({
        filename: "kimi-oauth-state.json",
        envSecret: "KIMI_SECRET",
        secretPathName: "kimi-secret",
        label: "kimi",
        keyContext: "ai.diy:kimi-session-store:v1:",
        redisPrefix: "ai.diy:kimi:kimi-oauth-state.json:",
    }));
}

function getSessionStore(): KeyValueStore<StoredSession> {
    return (sessionStore ??= resolveNamedSessionStore<StoredSession>({
        filename: "kimi-sessions.json",
        envSecret: "KIMI_SECRET",
        secretPathName: "kimi-secret",
        label: "kimi",
        keyContext: "ai.diy:kimi-session-store:v1:",
        redisPrefix: "ai.diy:kimi:kimi-sessions.json:",
    }));
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

function cookie(name: string, value: string, request: Request, maxAge: number): string {
    return serializeCookie(name, value, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: secureCookie(request),
        maxAge,
    });
}

function deviceId(): string {
    return (
        process.env.KIMI_DEVICE_ID?.trim() ||
        "aidiy-kimi-device"
    );
}

function kimiHeaders(): Record<string, string> {
    return {
        "X-Msh-Platform": "kimi_cli",
        "X-Msh-Version": KIMI_CLIENT_VERSION,
        "X-Msh-Device-Name": "ai.diy",
        "X-Msh-Device-Model": "ai.diy",
        "X-Msh-Os-Version": "web",
        "X-Msh-Device-Id": deviceId(),
    };
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
    const response = await fetch(`${KIMI_OAUTH_HOST.replace(/\/+$/, "")}/api/oauth/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...kimiHeaders(),
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: KIMI_CLIENT_ID,
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

export async function getKimiSession(request: Request): Promise<KimiSession> {
    return (await resolveKimiSession(request)).session;
}

export async function startKimiLogin(request: Request): Promise<Response> {
    const response = await fetch(
        `${KIMI_OAUTH_HOST.replace(/\/+$/, "")}/api/oauth/device_authorization`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                ...kimiHeaders(),
            },
            body: new URLSearchParams({ client_id: KIMI_CLIENT_ID }),
        },
    );
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
            "[kimi/oauth] Device authorization failed:",
            typeof payload.error_description === "string"
                ? payload.error_description
                : `HTTP ${response.status}`,
        );
        return new Response("Kimi membership authorization is temporarily unavailable.", {
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
        cookie(KIMI_PENDING_COOKIE, state, request, Math.ceil(expiresIn)),
    );
    return redirect;
}

async function resolveKimiSession(
    request: Request,
): Promise<{ session: KimiSession; sessionId?: string }> {
    const sessionId = readCookie(request, KIMI_COOKIE);
    if (sessionId) {
        const stored = await getSessionStore().get(sessionId);
        if (stored) {
            const refreshed = await refreshStoredSession(sessionId, stored);
            if (refreshed) return { session: { status: "authenticated" } };
        }
    }

    const pendingId = readCookie(request, KIMI_PENDING_COOKIE);
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

    const response = await fetch(`${KIMI_OAUTH_HOST.replace(/\/+$/, "")}/api/oauth/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...kimiHeaders(),
        },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            client_id: KIMI_CLIENT_ID,
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

export async function getKimiSessionResponse(request: Request): Promise<Response> {
    const result = await resolveKimiSession(request);
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
                KIMI_COOKIE,
                result.sessionId,
                request,
                Math.floor(SESSION_TTL_MS / 1000),
            ),
        );
        response.headers.append(
            "Set-Cookie",
            cookie(KIMI_PENDING_COOKIE, "", request, 0),
        );
    }
    return response;
}

export async function logoutKimi(request: Request): Promise<Response> {
    const sessionId = readCookie(request, KIMI_COOKIE);
    if (sessionId) await getSessionStore().delete(sessionId);
    const response = new Response(null, {
        status: 204,
        headers: {
            "Cache-Control": "no-store",
            "Set-Cookie": cookie(KIMI_COOKIE, "", request, 0),
        },
    });
    response.headers.append(
        "Set-Cookie",
        cookie(KIMI_PENDING_COOKIE, "", request, 0),
    );
    return response;
}

export async function kimiAccessToken(request: Request): Promise<string> {
    const sessionId = readCookie(request, KIMI_COOKIE);
    if (!sessionId) {
        throw new Error("Sign in with Kimi under Settings before using this provider.");
    }
    const stored = await getSessionStore().get(sessionId);
    if (!stored?.accessToken) {
        throw new Error("Sign in with Kimi under Settings before using this provider.");
    }
    const session = await refreshStoredSession(sessionId, stored);
    if (!session) {
        throw new Error("Sign in with Kimi under Settings before using this provider.");
    }
    return session.accessToken;
}

export function kimiProxyFetch(request: Request): typeof fetch {
    return async (input, init) => {
        const token = await kimiAccessToken(request);
        const headers = new Headers(
            input instanceof Request ? input.headers : undefined,
        );
        new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
        headers.set("Authorization", `Bearer ${token}`);
        for (const [key, value] of Object.entries(kimiHeaders())) {
            headers.set(key, value);
        }
        return fetch(input, { ...init, headers });
    };
}

export async function listKimiModels(
    request: Request,
): Promise<
    Array<{
        id: string;
        name: string;
        contextWindow?: number;
        supportsVision?: boolean;
        supportsReasoning?: boolean;
    }>
> {
    const modelsUrl = `${KIMI_PROXY_URL.replace(/\/+$/, "")}/models`;
    const response = await kimiProxyFetch(request)(modelsUrl, {
        headers: { Accept: "application/json" },
    });
    const payload = await readJson(response);
    if (!response.ok) {
        throw new Error(
            typeof payload.error === "string"
                ? payload.error
                : `Kimi models request failed (HTTP ${response.status})`,
        );
    }
    const data = Array.isArray(payload.data) ? payload.data : [];
    const models: Array<{
        id: string;
        name: string;
        contextWindow?: number;
        supportsVision?: boolean;
        supportsReasoning?: boolean;
    }> = [];
    for (const item of data) {
        if (!item || typeof item !== "object") continue;
        const value = item as {
            id?: unknown;
            name?: unknown;
            display_name?: unknown;
            context_length?: unknown;
            supports_image_in?: unknown;
            supports_reasoning?: unknown;
        };
        if (typeof value.id !== "string" || !value.id.trim()) continue;
        models.push({
            id: value.id,
            name:
                (typeof value.display_name === "string" && value.display_name.trim()) ||
                (typeof value.name === "string" && value.name.trim()) ||
                prettyKimiName(value.id),
            contextWindow:
                typeof value.context_length === "number" && value.context_length > 0
                    ? value.context_length
                    : undefined,
            supportsVision:
                typeof value.supports_image_in === "boolean"
                    ? value.supports_image_in
                    : undefined,
            supportsReasoning:
                typeof value.supports_reasoning === "boolean"
                    ? value.supports_reasoning
                    : undefined,
        });
    }
    return models.sort((a, b) => a.id.localeCompare(b.id));
}

function prettyKimiName(id: string): string {
    return id
        .replace(/^kimi-/, "Kimi ")
        .replace(/k2\.(\d)/gi, "K2.$1")
        .replace(/k3/gi, "K3")
        .replace(/-code-highspeed/i, " Code Highspeed")
        .replace(/-code/i, " Code")
        .replace(/-/g, " ");
}

export function kimiProxyUrl(): string {
    return KIMI_PROXY_URL;
}