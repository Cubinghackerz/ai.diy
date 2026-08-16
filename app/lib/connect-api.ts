/**
 * Thin client wrapper around /api/connect (Vercel Connect support endpoints).
 * Success responses are JSON; network/HTTP errors reject like fetch.
 */

export type ConnectConnectorEntryLite = {
    key: string;
    connectorId: string;
    baseUrl?: string;
    scopes?: string[];
};

export type ConnectListResponse = {
    available: boolean;
    connectors: ConnectConnectorEntryLite[];
};

export type ConnectTestResponse =
    | { ok: true; expiresAt: number; connectorId: string }
    | {
          ok: false;
          kind: string;
          message: string;
          authorizeUrl?: string;
          error?: string;
      };

export type ConnectAuthorizeResponse =
    | { ok: true; url: string }
    | { ok: false; error: string };

type ConnectStatusResponse =
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

async function connectApi<T>(payload: {
    action: "list" | "status" | "test" | "authorize";
    connectorId?: string;
    scopes?: string[];
}): Promise<T> {
    const response = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => null)) as
        | (T & { error?: string })
        | null;
    if (!response.ok || !data) {
        throw new Error(
            data?.error || `Vercel Connect request failed (${response.status}).`,
        );
    }
    return data as T;
}

export function connectList(): Promise<ConnectListResponse> {
    return connectApi<ConnectListResponse>({ action: "list" });
}

export function connectTest(
    connectorId: string,
    scopes?: string[],
): Promise<ConnectTestResponse> {
    return connectApi<ConnectTestResponse>({
        action: "test",
        connectorId,
        scopes,
    });
}

export function connectStatus(
    connectorId: string,
): Promise<ConnectStatusResponse> {
    return connectApi<ConnectStatusResponse>({
        action: "status",
        connectorId,
    });
}

export function connectAuthorize(
    connectorId: string,
    scopes?: string[],
): Promise<ConnectAuthorizeResponse> {
    return connectApi<ConnectAuthorizeResponse>({
        action: "authorize",
        connectorId,
        scopes,
    });
}