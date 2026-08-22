/**
 * LLM Provider Registry
 *
 * Factory for getting the appropriate provider adapter for each ProviderId.
 * Providers that expose an OpenAI-compatible models endpoint reuse
 * OpenAIProvider; the rest use native adapters. Chat streaming itself is
 * handled by the AI SDK route (app/lib/server/model.ts) — these adapters only
 * power live model discovery in /api/models.
 */

import type { LLMProvider } from "./types";
import type { ProviderId } from "~/lib/types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { BedrockProvider } from "./bedrock";
import { AzureProvider } from "./azure";
import { VertexProvider } from "./vertex";
import { GatewayProvider } from "./gateway";
import { CohereProvider } from "./cohere";
import { NoDiscoveryProvider } from "./no-discovery";

const providers = new Map<ProviderId, LLMProvider>();

// OpenAI-compatible API surface
providers.set("openai", new OpenAIProvider("openai"));
providers.set("groq", new OpenAIProvider("groq"));
providers.set("cerebras", new OpenAIProvider("cerebras"));
providers.set("fireworks", new OpenAIProvider("fireworks"));
providers.set("openrouter", new OpenAIProvider("openrouter"));
providers.set("xai", new OpenAIProvider("xai"));
providers.set("grok", new OpenAIProvider("grok"));
providers.set("deepseek", new OpenAIProvider("deepseek"));
providers.set("togetherai", new OpenAIProvider("togetherai"));
providers.set("mistral", new OpenAIProvider("mistral"));
providers.set("huggingface", new OpenAIProvider("huggingface"));
providers.set("ollama", new OpenAIProvider("ollama"));
providers.set("lmstudio", new OpenAIProvider("lmstudio"));
providers.set("custom", new OpenAIProvider("custom"));

// Native SDKs (Anthropic / Gemini use their own wire formats; the rest
// have no OpenAI-compatible model listing).
providers.set("anthropic", new AnthropicProvider());
providers.set("gemini", new GeminiProvider());
providers.set("bedrock", new BedrockProvider());
providers.set("azure", new AzureProvider());
providers.set("vertex", new VertexProvider());
providers.set("gateway", new GatewayProvider());
providers.set("perplexity", new NoDiscoveryProvider("perplexity"));
providers.set("cohere", new CohereProvider());

export function getProvider(id: ProviderId): LLMProvider {
    const provider = providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
}

export function getAllProviders(): LLMProvider[] {
    return Array.from(providers.values());
}
