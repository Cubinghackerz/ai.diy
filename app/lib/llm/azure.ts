/**
 * Azure OpenAI Provider Adapter
 *
 * Model discovery via the Azure OpenAI models API. Chat streaming goes through
 * the AI SDK route (createAzure). Credentials are passed as structured JSON in
 * the apiKey field:
 *   { "resourceName": "my-resource", "apiKey": "...", "apiVersion": "2024-06-01" }
 * or a plain API key with the endpoint set as the base URL.
 */

import type { ChatRequest, StreamCallbacks, LLMProvider } from "./types";
import { parseProviderCredentials } from "~/lib/provider-credentials";

export class AzureProvider implements LLMProvider {
    id = "azure" as const;

    async streamChat(_request: ChatRequest, _callbacks: StreamCallbacks): Promise<void> {
        throw new Error("Azure chat streaming is handled by the AI SDK route.");
    }

    async listModels(
        apiKey: string,
        baseUrl?: string,
    ): Promise<{ id: string; name: string }[]> {
        const creds = parseProviderCredentials("azure", apiKey);
        const key = creds.apiKey ?? apiKey;

        const base =
            baseUrl ||
            creds.baseURL ||
            (creds.resourceName
                ? `https://${creds.resourceName}.openai.azure.com`
                : "");
        if (!base) {
            throw new Error(
                "Azure needs a resource name or base URL. Paste JSON credentials.",
            );
        }

        const apiVersion = creds.apiVersion ?? "2024-06-01";
        const url = `${base.replace(/\/$/, "")}/openai/models?api-version=${apiVersion}`;
        const res = await fetch(url, { headers: { "api-key": key } });
        if (!res.ok) {
            const detail = (await res.text()).slice(0, 240);
            if (res.status === 401 || res.status === 403) {
                throw new Error("Invalid Azure OpenAI API key.");
            }
            throw new Error(
                `Azure models API failed (HTTP ${res.status}${detail ? `: ${detail}` : ""})`,
            );
        }
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        return (data.data ?? [])
            .map((m) => ({ id: m.id, name: m.id }))
            .sort((a, b) => a.id.localeCompare(b.id));
    }
}
