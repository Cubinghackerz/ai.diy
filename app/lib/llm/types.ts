/**
 * LLM Provider Abstraction Layer
 * 
 * Defines the interface used by the provider registry. Chat streaming itself
 * is handled by the AI SDK route; adapters also provide live model discovery.
 */

import type { ProviderId } from "~/lib/types";

export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
}

export interface LLMTool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export interface ChatRequest {
    messages: ChatMessage[];
    model: string;
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number | null;
    topP?: number;
    tools?: LLMTool[];
    signal?: AbortSignal;
}

export interface StreamCallbacks {
    onText: (text: string) => void;
    onToolCall?: (toolCall: { id: string; name: string; args: Record<string, unknown> }) => void;
    onUsage?: (usage: { promptTokens?: number; completionTokens?: number }) => void;
    onReasoning?: (text: string) => void;
}

export interface LLMProvider {
    id: ProviderId;
    streamChat(request: ChatRequest, callbacks: StreamCallbacks): Promise<void>;
    listModels(
        apiKey: string,
        baseUrl?: string,
        headers?: Record<string, string>,
        timeoutMs?: number,
        maxRetries?: number,
        authMode?: "bearer" | "api-key-header" | "custom-header" | "none",
    ): Promise<{ id: string; name: string }[]>;
}
