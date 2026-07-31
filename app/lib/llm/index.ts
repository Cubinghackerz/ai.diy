/**
 * LLM Provider Registry
 * 
 * Factory for getting the appropriate provider adapter for each ProviderId.
 * Supports 5 providers: OpenAI, Anthropic, Google Gemini, Groq, OpenRouter.
 */

import type { LLMProvider } from "./types";
import type { ProviderId } from "~/lib/types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";

const providers = new Map<ProviderId, LLMProvider>();

// Register all 5 providers
// OpenAI, Groq, and OpenRouter all use the OpenAI-compatible API
providers.set("openai", new OpenAIProvider("openai"));
providers.set("anthropic", new AnthropicProvider());
providers.set("gemini", new GeminiProvider());
providers.set("groq", new OpenAIProvider("groq"));
providers.set("openrouter", new OpenAIProvider("openrouter"));
providers.set("ollama", new OpenAIProvider("ollama"));
providers.set("custom", new OpenAIProvider("custom"));

export function getProvider(id: ProviderId): LLMProvider {
    const provider = providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
}

export function getAllProviders(): LLMProvider[] {
    return Array.from(providers.values());
}