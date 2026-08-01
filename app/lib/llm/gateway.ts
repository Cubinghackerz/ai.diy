/**
 * Vercel AI Gateway Provider Adapter
 *
 * Model discovery via the Gateway's getAvailableModels(). Chat streaming goes
 * through the AI SDK route (createGateway) in api.chat.ts.
 */

import { createGateway } from "@ai-sdk/gateway";
import type { ChatRequest, StreamCallbacks, LLMProvider } from "./types";

export class GatewayProvider implements LLMProvider {
    id = "gateway" as const;

    async streamChat(_request: ChatRequest, _callbacks: StreamCallbacks): Promise<void> {
        throw new Error("Gateway chat streaming is handled by the AI SDK route.");
    }

    async listModels(
        apiKey: string,
        baseUrl?: string,
    ): Promise<{ id: string; name: string }[]> {
        const provider = createGateway({
            apiKey,
            baseURL: baseUrl || undefined,
        });
        try {
            const meta = await provider.getAvailableModels();
            return (meta.models ?? [])
                .map((m) => ({ id: m.id, name: m.name || m.id }))
                .sort((a, b) => a.id.localeCompare(b.id));
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unknown Gateway error";
            if (/invalid|unauthorized|forbidden|401|403/i.test(message)) {
                throw new Error("Invalid Vercel AI Gateway token.");
            }
            throw new Error(`Gateway models API failed: ${message}`);
        }
    }
}
