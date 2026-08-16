import {
    ConnectorInstallationRequiredError,
    UserAuthorizationRequiredError,
    getConnectorMetadata,
    getTokenResponse,
    startAuthorization,
} from "@vercel/connect";

/**
 * Vercel Connect integration (app-subject tokens).
 *
 * Auth paths:
 * - On Vercel: the platform injects `VERCEL_OIDC_TOKEN`; the SDK uses it
 *   automatically — no configuration needed.
 * - Self-hosted: set `VERCEL_TOKEN` (a Vercel access token for the team that
 *   owns the connectors). Vercel remains the authorization hub.
 * - Neither present: the feature is inert (`connectAvailable()` is false).
 *
 * Connectors are declared in the environment as `CONNECT_CONNECTOR_<KEY>=<id>`
 * where `<id>` is a connector id (`scl_…`) or UID. Optional per-connector:
 * `CONNECT_BASE_URL_<KEY>` (API root for `connect_request` calls) and
 * `CONNECT_SCOPES_<KEY>` (space-separated app scopes).
 */

export type ConnectConnectorEntry = {
    /** Uppercase env key, e.g. `GITHUB`. */
    key: string;
    /** Vercel Connect connector id (`scl_…`) or UID. */
    connectorId: string;
    /** Optional provider API root for `connect_request` calls. */
    baseUrl?: string;
    /** Optional space-separated app scopes from `CONNECT_SCOPES_<KEY>`. */
    scopes?: string[];
};

export type ConnectTokenResult =
    | { ok: true; token: string; expiresAt: number; connectorId: string }
    | { ok: false; kind: "not-configured"; message: string }
    | {
          ok: false;
          kind: "authorization-required";
          message: string;
          authorizeUrl: string | null;
      }
    | { ok: false; kind: "installation-required"; message: string }
    | { ok: false; kind: "disconnected"; message: string }
    | { ok: false; kind: "error"; message: string };

/** True when either Vercel OIDC (deployed) or a Vercel access token (self-host) is available. */
export function connectAvailable(): boolean {
    return Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_TOKEN);
}

export function connectCredentialHint(): string {
    return "Deploy to Vercel (OIDC is automatic) or self-host with VERCEL_TOKEN set.";
}

/** Vercel access token for self-hosted runs; undefined on Vercel (OIDC path). */
function vercelTokenOption(): { vercelToken: string } | undefined {
    if (process.env.VERCEL_TOKEN) {
        return { vercelToken: process.env.VERCEL_TOKEN };
    }
    return undefined;
}

export function listConnectConnectors(): ConnectConnectorEntry[] {
    const entries: ConnectConnectorEntry[] = [];
    for (const [name, raw] of Object.entries(process.env)) {
        const match = /^CONNECT_CONNECTOR_([A-Z0-9_]+)$/.exec(name);
        if (!match) continue;
        const key = match[1];
        const connectorId = (raw ?? "").trim();
        if (!connectorId) continue;
        entries.push({
            key,
            connectorId,
            baseUrl: process.env[`CONNECT_BASE_URL_${key}`]?.trim() || undefined,
            scopes: splitScopes(process.env[`CONNECT_SCOPES_${key}`]),
        });
    }
    return entries.sort((a, b) => a.key.localeCompare(b.key));
}

/** Resolve a `connect_request` connector argument (key, id, or UID). */
export function resolveConnectConnector(
    entry: string | undefined,
): ConnectConnectorEntry | undefined {
    if (!entry?.trim()) return undefined;
    const needle = entry.trim();
    const byKey = listConnectConnectors().find(
        (candidate) =>
            candidate.key === needle ||
            candidate.key === needle.toUpperCase() ||
            candidate.connectorId === needle,
    );
    return byKey ?? { key: "__direct__", connectorId: needle };
}

function splitScopes(raw: string | undefined): string[] | undefined {
    if (!raw?.trim()) return undefined;
    const scopes = raw
        .trim()
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
    return scopes.length > 0 ? scopes : undefined;
}

function connectErrorHint(err: unknown): ConnectTokenResult & { ok: false } {
    if (err instanceof UserAuthorizationRequiredError) {
        return {
            ok: false,
            kind: "authorization-required",
            message: "This connector needs authorization before tokens can be minted.",
            authorizeUrl: null,
        };
    }
    if (err instanceof ConnectorInstallationRequiredError) {
        return {
            ok: false,
            kind: "installation-required",
            message: `The connector is not linked to this project/environment. Install it from the Vercel dashboard or \`npx vercel connect create\`. (${
                err.message || err.code || ""
            })`.trim(),
        };
    }
    const message = err instanceof Error ? err.message : String(err);
    const code =
        err instanceof Error && err instanceof UserAuthorizationRequiredError
            ? err.code
            : (err as { code?: string } | null)?.code;
    if (code === "no_token" || /no token|cannot connect|disconnected/i.test(message)) {
        return {
            ok: false,
            kind: "disconnected",
            message: `The provider reported a disconnected grant (${message}). Re-authorize the connector.`,
        };
    }
    return { ok: false, kind: "error", message };
}

/**
 * Mint an app-subject token for a connector.
 *
 * On `authorization-required` the returned result carries an `authorizeUrl`
 * (already started via `startAuthorization`) that the operator must open and
 * complete; after that, `getToken` succeeds.
 */
export async function requestConnectToken(
    connectorId: string,
    scopes?: string[],
    options?: { forceRefresh?: boolean },
): Promise<ConnectTokenResult> {
    if (!connectAvailable()) {
        return {
            ok: false,
            kind: "not-configured",
            message: `Vercel Connect is not configured for this deployment. ${connectCredentialHint()}`,
        };
    }
    try {
        const response = await getTokenResponse(
            connectorId,
            {
                subject: { type: "app" },
                scopes: scopes && scopes.length > 0 ? scopes : undefined,
            },
            { ...vercelTokenOption(), forceRefresh: options?.forceRefresh },
        );
        return {
            ok: true,
            token: response.token,
            expiresAt: response.expiresAt,
            connectorId: response.connector?.id ?? connectorId,
        };
    } catch (err) {
        if (
            err instanceof UserAuthorizationRequiredError &&
            connectAvailable()
        ) {
            const started = await startConnectAuthorization(connectorId, scopes);
            if (started.ok) {
                return {
                    ok: false,
                    kind: "authorization-required",
                    message:
                        "Authorization needed — open the returned URL, complete the provider consent, then retry.",
                    authorizeUrl: started.url,
                };
            }
            return {
                ok: false,
                kind: "authorization-required",
                message: `Authorization needed, but the authorization flow could not be started: ${started.error}`,
                authorizeUrl: null,
            };
        }
        return connectErrorHint(err);
    }
}

export async function startConnectAuthorization(
    connectorId: string,
    scopes?: string[],
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
    if (!connectAvailable()) {
        return {
            ok: false,
            error: `Vercel Connect is not configured for this deployment. ${connectCredentialHint()}`,
        };
    }
    try {
        const response = await startAuthorization(
            connectorId,
            {
                subject: { type: "app" },
                scopes: scopes && scopes.length > 0 ? scopes : undefined,
            },
            vercelTokenOption(),
        );
        if (!response.url) return { ok: false, error: "Vercel Connect returned no authorization URL." };
        return { ok: true, url: response.url };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export type ConnectInspection =
    | {
          ok: true;
          name: string;
          uid: string;
          type: string;
          service?: string;
          clientUrl?: string;
          token: { expiresAt: number; externalSubject?: string; tenantId?: string };
      }
    | { ok: false; error: string };

export async function inspectConnectConnector(
    connectorId: string,
): Promise<ConnectInspection> {
    if (!connectAvailable()) {
        return {
            ok: false,
            error: `Vercel Connect is not configured for this deployment. ${connectCredentialHint()}`,
        };
    }
    try {
        const metadata = await getConnectorMetadata(connectorId, vercelTokenOption());
        const token = await getTokenResponse(
            connectorId,
            { subject: { type: "app" }, scopes: undefined },
            vercelTokenOption(),
        );
        return {
            ok: true,
            name: metadata.name,
            uid: metadata.uid,
            type: metadata.type,
            service: metadata.service,
            clientUrl: metadata.clientUrl,
            token: {
                expiresAt: token.expiresAt,
                externalSubject: token.externalSubject,
                tenantId: token.tenantId,
            },
        };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}