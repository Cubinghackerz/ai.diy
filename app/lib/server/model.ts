import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAzure } from "@ai-sdk/azure";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGateway } from "@ai-sdk/gateway";
import { createGoogleVertex } from "@ai-sdk/google-vertex";
import { createHuggingFace } from "@ai-sdk/huggingface";
import { createMistral } from "@ai-sdk/mistral";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { createCerebras } from "@ai-sdk/cerebras";
import { createFireworks } from "@ai-sdk/fireworks";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createCohere } from "@ai-sdk/cohere";
import { createChatGPTProxyProvider } from "@opencoredev/loginwithchatgpt-ai";
import type { ImageModel, SpeechModel } from "ai";
import { experimental_generateVideo } from "ai";
import type { ProviderConfig, ProviderId } from "~/lib/types";
import { parseProviderCredentials } from "~/lib/provider-credentials";
import {
    modelSupportsReasoning,
    type ReasoningEffort,
} from "~/lib/reasoning";
import { getChatGPTHandler } from "~/lib/server/chatgpt-auth";
import { normalizeProviderBaseUrl } from "~/lib/server/provider-url";
import { createCompatibleFetch } from "~/lib/server/compatible-fetch";

export type ModelRequest = {
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
    model: string;
    openAICompatible?: ProviderConfig["openAICompatible"];
    reasoningEffort?: ReasoningEffort;
    /** Required for provider === "chatgpt" (session cookie via proxyFetch). */
    request?: Request;
};

export function createChatModel(body: ModelRequest) {
    const { provider, apiKey, baseUrl, model } = body;
    const credentials = parseProviderCredentials(provider, apiKey);
    const key = credentials.apiKey || apiKey;
    const resolvedBaseUrl = normalizeProviderBaseUrl(provider, baseUrl);
    const compatibleHeaders = body.openAICompatible?.headers;

    switch (provider) {
        case "chatgpt": {
            if (!body.request) {
                throw new Error(
                    "ChatGPT subscription requires an authenticated HTTP request (session cookie).",
                );
            }
            const headers: Record<string, string> = {};
            if (body.reasoningEffort) {
                headers["x-login-with-chatgpt-reasoning-effort"] =
                    body.reasoningEffort === "off"
                        ? "none"
                        : body.reasoningEffort === "minimal"
                          ? "low"
                          : body.reasoningEffort;
            }
            const chatgpt = createChatGPTProxyProvider({
                fetch: getChatGPTHandler().proxyFetch(body.request),
                ...(Object.keys(headers).length ? { headers } : {}),
            });
            return chatgpt(model);
        }
        case "openai": {
            const openai = createOpenAI({
                apiKey: key,
                baseURL: resolvedBaseUrl,
                headers: compatibleHeaders,
            });
            return shouldUseOpenAIResponses(provider, model, resolvedBaseUrl, body.openAICompatible)
                ? openai.responses(model)
                : openai.chat(model);
        }
        case "anthropic":
            return createAnthropic({ apiKey: key, baseURL: resolvedBaseUrl })(model);
        case "gemini":
            return createGoogleGenerativeAI({ apiKey: key })(model);
        case "groq":
            return createOpenAI({ apiKey: key, baseURL: resolvedBaseUrl || "https://api.groq.com/openai/v1", headers: compatibleHeaders }).chat(model);
        case "cerebras":
            return createCerebras({
                apiKey: key,
                baseURL: resolvedBaseUrl,
                headers: compatibleHeaders,
            })(model);
        case "fireworks":
            return createFireworks({
                apiKey: key,
                baseURL: resolvedBaseUrl,
                headers: compatibleHeaders,
            })(model);
        case "perplexity":
            return createPerplexity({
                apiKey: key,
                baseURL: resolvedBaseUrl,
                headers: compatibleHeaders,
            })(model);
        case "cohere":
            return createCohere({
                apiKey: key,
                baseURL: resolvedBaseUrl,
                headers: compatibleHeaders,
            })(model);
        case "xai":
            return createXai({ apiKey: key, baseURL: resolvedBaseUrl || "https://api.x.ai/v1" }).chat(model);
        case "openrouter":
            return createOpenAI({ apiKey: key, baseURL: resolvedBaseUrl || "https://openrouter.ai/api/v1", headers: compatibleHeaders }).chat(model);
        case "deepseek":
            return createDeepSeek({ apiKey: key, baseURL: resolvedBaseUrl }).chat(model);
        case "bedrock":
            return createAmazonBedrock({
                apiKey: credentials.apiKey,
                region: credentials.region,
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
                sessionToken: credentials.sessionToken,
                baseURL: resolvedBaseUrl || credentials.baseURL || undefined,
            })(model);
        case "azure":
            return createAzure({
                apiKey: credentials.apiKey,
                resourceName: credentials.resourceName,
                apiVersion: credentials.apiVersion,
                baseURL: resolvedBaseUrl || credentials.baseURL || undefined,
            }).chat(model);
        case "vertex":
            return createGoogleVertex({
                apiKey: credentials.apiKey,
                project: credentials.project,
                location: credentials.location,
                baseURL: resolvedBaseUrl || credentials.baseURL || undefined,
                ...(credentials.clientEmail && credentials.privateKey
                    ? {
                          googleAuthOptions: {
                              credentials: {
                                  client_email: credentials.clientEmail,
                                  private_key: credentials.privateKey,
                              },
                          },
                      }
                    : {}),
            })(model);
        case "gateway":
            return createGateway({
                apiKey: key,
                baseURL: resolvedBaseUrl,
            }).chat(model);
        case "togetherai":
            return createTogetherAI({ apiKey: key, baseURL: resolvedBaseUrl })(model);
        case "mistral":
            return createMistral({ apiKey: key, baseURL: resolvedBaseUrl }).chat(model);
        case "huggingface":
            return createHuggingFace({ apiKey: key, baseURL: resolvedBaseUrl }).responses(model);
        case "ollama":
            return createOpenAI({ apiKey: key || "ollama", baseURL: resolvedBaseUrl || "http://localhost:11434/v1", headers: compatibleHeaders }).chat(model);
        case "lmstudio":
            return createOpenAI({ apiKey: key || "lmstudio", baseURL: resolvedBaseUrl || "http://localhost:1234/v1", headers: compatibleHeaders }).chat(model);
        case "custom": {
            const useBearer = body.openAICompatible?.authMode !== "none" &&
                body.openAICompatible?.authMode !== "api-key-header" &&
                body.openAICompatible?.authMode !== "custom-header";
            const compatible = createOpenAI({
                apiKey: useBearer ? key || "custom" : "custom",
                baseURL: resolvedBaseUrl || "http://localhost:1234/v1",
                headers: compatibleHeaders,
                fetch: createCompatibleFetch(
                    body.openAICompatible?.timeoutMs,
                    body.openAICompatible?.maxRetries,
                    { stripAuthorization: !useBearer },
                ),
            });
            return body.openAICompatible?.apiMode === "responses"
                ? compatible.responses(model)
                : compatible.chat(model);
        }
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

/**
 * OpenAI's reasoning models support function tools through Responses, not
 * Chat Completions. Custom OpenAI-compatible endpoints must stay on chat.
 */
export function shouldUseOpenAIResponses(
    provider: ProviderId,
    model: string,
    baseUrl?: string,
    openAICompatible?: ProviderConfig["openAICompatible"],
): boolean {
    if (openAICompatible?.apiMode === "responses") return true;
    if (openAICompatible?.apiMode === "chat") return false;
    if (provider === "chatgpt") return true;
    if (provider !== "openai" || !modelSupportsReasoning(provider, model)) {
        return false;
    }
    if (!baseUrl) return true;
    try {
        return new URL(baseUrl).hostname === "api.openai.com";
    } catch {
        return false;
    }
}

export function createImageModel(body: ModelRequest): ImageModel {
    const { provider, apiKey, baseUrl, model } = body;
    const credentials = parseProviderCredentials(provider, apiKey);
    const key = credentials.apiKey || apiKey;
    const resolvedBaseUrl = normalizeProviderBaseUrl(provider, baseUrl);
    const compatibleHeaders = body.openAICompatible?.headers;

    switch (provider) {
        case "chatgpt":
            throw new Error(
                "ChatGPT subscription image generation uses the session proxy path, not a dedicated Images API key.",
            );
        case "openai":
        case "openrouter":
        case "custom":
            return createOpenAI({
                apiKey: key,
                baseURL: resolvedBaseUrl,
                headers: compatibleHeaders,
            }).imageModel(model);
        case "xai":
            return createXai({
                apiKey: key,
                baseURL: resolvedBaseUrl,
            }).imageModel(model);
        case "gemini":
            return createGoogleGenerativeAI({ apiKey: key }).image(model);
        case "gateway":
            return createGateway({
                apiKey: key,
                baseURL: resolvedBaseUrl,
            }).imageModel(model);
        case "bedrock":
            return createAmazonBedrock({
                apiKey: credentials.apiKey,
                region: credentials.region,
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
                sessionToken: credentials.sessionToken,
                baseURL: resolvedBaseUrl || credentials.baseURL || undefined,
            }).image(model);
        case "azure":
            return createAzure({
                apiKey: credentials.apiKey,
                resourceName: credentials.resourceName,
                apiVersion: credentials.apiVersion,
                baseURL: resolvedBaseUrl || credentials.baseURL || undefined,
            }).imageModel(model);
        case "vertex":
            return createGoogleVertex({
                apiKey: credentials.apiKey,
                project: credentials.project,
                location: credentials.location,
                baseURL: resolvedBaseUrl || credentials.baseURL || undefined,
            }).imageModel(model);
        case "togetherai":
            return createTogetherAI({
                apiKey: key,
                baseURL: resolvedBaseUrl,
            }).imageModel(model);
        case "fireworks":
            return createFireworks({
                apiKey: key,
                baseURL: resolvedBaseUrl,
                headers: compatibleHeaders,
            }).image(model);
        default:
            throw new Error(
                `${provider} does not expose an image-generation model through its SDK.`,
            );
    }
}

export function createSpeechModel(body: ModelRequest): SpeechModel {
    const { provider, apiKey, baseUrl, model } = body;
    const credentials = parseProviderCredentials(provider, apiKey);
    const key = credentials.apiKey || apiKey;
    const resolvedBaseUrl = normalizeProviderBaseUrl(provider, baseUrl);
    const compatibleHeaders = body.openAICompatible?.headers;

    switch (provider) {
        case "openai":
            return createOpenAI({
                apiKey: key,
                baseURL: resolvedBaseUrl,
                headers: compatibleHeaders,
            }).speech(model as never);
        case "openrouter":
        case "custom":
            return createOpenAI({
                apiKey: key,
                baseURL: resolvedBaseUrl,
                headers: compatibleHeaders,
            }).speech(model as never);
        case "gemini":
            return createGoogleGenerativeAI({ apiKey: key }).speech(model as never);
        case "vertex":
            return createGoogleVertex({
                apiKey: credentials.apiKey,
                project: credentials.project,
                location: credentials.location,
                baseURL: resolvedBaseUrl || credentials.baseURL || undefined,
            }).speech(model as never);
        case "gateway":
            return createGateway({ apiKey: key, baseURL: resolvedBaseUrl }).speech(
                model as never,
            );
        case "mistral":
            return createMistral({ apiKey: key, baseURL: resolvedBaseUrl }).speech(
                model as never,
            );
        case "azure":
            return createAzure({
                apiKey: credentials.apiKey,
                resourceName: credentials.resourceName,
                apiVersion: credentials.apiVersion,
                baseURL: resolvedBaseUrl || credentials.baseURL || undefined,
            }).speech(model as never);
        default:
            throw new Error(
                `${provider} does not expose a speech-generation model through its SDK.`,
            );
    }
}

type VideoModel = Parameters<typeof experimental_generateVideo>[0]["model"];

export function createVideoModel(body: ModelRequest): VideoModel {
    const { provider, apiKey, baseUrl, model } = body;
    const credentials = parseProviderCredentials(provider, apiKey);
    const key = credentials.apiKey || apiKey;
    const resolvedBaseUrl = normalizeProviderBaseUrl(provider, baseUrl);

    switch (provider) {
        case "gemini":
            return createGoogleGenerativeAI({ apiKey: key }).video(
                model as never,
            );
        case "vertex":
            return createGoogleVertex({
                apiKey: credentials.apiKey,
                project: credentials.project,
                location: credentials.location,
                baseURL: resolvedBaseUrl || credentials.baseURL || undefined,
                ...(credentials.clientEmail && credentials.privateKey
                    ? {
                          googleAuthOptions: {
                              credentials: {
                                  client_email: credentials.clientEmail,
                                  private_key: credentials.privateKey,
                              },
                          },
                      }
                    : {}),
            }).video(model as never);
        case "gateway":
            return createGateway({
                apiKey: key,
                baseURL: resolvedBaseUrl,
            }).video(model as never);
        default:
            throw new Error(
                `${provider} does not expose a video-generation model through its SDK.`,
            );
    }
}
