/**
 * Adapter for providers whose chat API has a documented model catalog but no
 * authenticated models endpoint. The route falls back to DEFAULT_MODELS.
 */

import type { ProviderId } from "~/lib/types";
import type { ChatRequest, StreamCallbacks, LLMProvider } from "./types";

export class NoDiscoveryProvider implements LLMProvider {
    constructor(public readonly id: ProviderId) {}

    async streamChat(_request: ChatRequest, _callbacks: StreamCallbacks): Promise<void> {
        throw new Error(`${this.id} chat streaming is handled by the AI SDK route.`);
    }

    async listModels(): Promise<{ id: string; name: string }[]> {
        return [];
    }
}
