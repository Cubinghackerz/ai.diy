/**
 * Google Vertex AI Provider Adapter
 *
 * Model discovery via the Vertex AI publishers API. Chat streaming goes through
 * the AI SDK route (createGoogleVertex). Credentials are passed as structured
 * JSON in the apiKey field:
 *   { "project": "...", "location": "us-central1",
 *     "clientEmail": "...", "privateKey": "-----BEGIN PRIVATE KEY-----..." }
 * or a plain API key (Vertex express mode).
 */

import type { ChatRequest, StreamCallbacks, LLMProvider } from "./types";
import { parseProviderCredentials } from "~/lib/provider-credentials";

export class VertexProvider implements LLMProvider {
    id = "vertex" as const;

    async streamChat(_request: ChatRequest, _callbacks: StreamCallbacks): Promise<void> {
        throw new Error("Vertex chat streaming is handled by the AI SDK route.");
    }

    async listModels(
        apiKey: string,
        baseUrl?: string,
    ): Promise<{ id: string; name: string }[]> {
        const creds = parseProviderCredentials("vertex", apiKey);
        const location = creds.location ?? "us-central1";
        const base =
            baseUrl ||
            creds.baseURL ||
            `https://${location}-aiplatform.googleapis.com`;

        // Express mode: plain API key on the query string.
        if (creds.apiKey && !creds.clientEmail) {
            const url = `${base.replace(/\/$/, "")}/v1beta1/publishers/google/models?key=${encodeURIComponent(creds.apiKey)}`;
            const res = await fetch(url);
            return parseListResponse(res);
        }

        const project = creds.project ?? "";
        if (!project) {
            throw new Error(
                "Vertex needs a project id (plus clientEmail/privateKey). Paste JSON credentials.",
            );
        }

        const { GoogleAuth } = await import("google-auth-library");
        const auth = new GoogleAuth({
            ...(creds.clientEmail && creds.privateKey
                ? {
                      credentials: {
                          client_email: creds.clientEmail,
                          private_key: creds.privateKey,
                      },
                  }
                : {}),
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (!token?.token) {
            throw new Error("Vertex authentication failed — could not get an access token.");
        }

        const url = `${base.replace(/\/$/, "")}/v1/projects/${project}/locations/${location}/publishers/google/models`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token.token}` },
        });
        return parseListResponse(res);
    }
}

async function parseListResponse(
    res: Response,
): Promise<{ id: string; name: string }[]> {
    if (!res.ok) {
        const detail = (await res.text()).slice(0, 240);
        if (res.status === 401 || res.status === 403) {
            throw new Error("Invalid Google Vertex credentials.");
        }
        throw new Error(
            `Vertex models API failed (HTTP ${res.status}${detail ? `: ${detail}` : ""})`,
        );
    }
    const data = (await res.json()) as { models?: Array<{ name: string; displayName?: string }> };
    return (data.models ?? [])
        .map((m) => ({
            id: m.name.split("/").pop() ?? m.name,
            name: m.displayName || m.name.split("/").pop() || m.name,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}
