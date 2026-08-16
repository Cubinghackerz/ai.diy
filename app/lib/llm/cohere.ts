/**
 * Cohere model discovery adapter.
 *
 * Chat streaming itself is handled by the AI SDK route. Cohere exposes model
 * discovery on its v1 control API while chat uses the v2 API.
 */

import type { ChatRequest, StreamCallbacks, LLMProvider } from "./types";

type CohereModel = {
    name?: string;
    is_deprecated?: boolean;
    endpoints?: string[];
};

export class CohereProvider implements LLMProvider {
    id = "cohere" as const;

    async streamChat(_request: ChatRequest, _callbacks: StreamCallbacks): Promise<void> {
        throw new Error("Cohere chat streaming is handled by the AI SDK route.");
    }

    async listModels(
        apiKey: string,
        baseUrl?: string,
    ): Promise<{ id: string; name: string }[]> {
        const base = new URL(baseUrl || "https://api.cohere.com/v2");
        const path = base.pathname.replace(/\/$/, "");
        const root = path.endsWith("/v1") || path.endsWith("/v2")
            ? path.slice(0, -3)
            : path;
        base.pathname = `${root}/v1/models`;
        base.search = "";
        base.searchParams.set("endpoint", "chat");
        base.searchParams.set("page_size", "1000");

        const response = await fetch(base, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const detail = (await response.text()).slice(0, 240);
            if (response.status === 401 || response.status === 403) {
                throw new Error("Invalid Cohere API key.");
            }
            throw new Error(
                `Cohere models API failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
            );
        }

        const data = (await response.json()) as { models?: CohereModel[] };
        return (data.models ?? [])
            .filter((model) => model.name && model.is_deprecated !== true)
            .filter((model) => !model.endpoints || model.endpoints.includes("chat"))
            .map((model) => ({ id: model.name!, name: model.name! }))
            .sort((a, b) => a.id.localeCompare(b.id));
    }
}
