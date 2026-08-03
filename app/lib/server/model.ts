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
import type { ImageModel } from "ai";
import { experimental_generateVideo } from "ai";
import type { ProviderConfig, ProviderId } from "~/lib/types";
import { parseProviderCredentials } from "~/lib/provider-credentials";
import { modelSupportsReasoning } from "~/lib/reasoning";
import { normalizeProviderBaseUrl } from "~/lib/server/provider-url";
import { createCompatibleFetch } from "~/lib/server/compatible-fetch";

export type ModelRequest = {
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
    model: string;
    openAICompatible?: ProviderConfig["openAICompatible"];
};

export function createChatModel(body: ModelRequest) {
    const { provider, apiKey, baseUrl, model } = body;
    const credentials = parseProviderCredentials(provider, apiKey);
    const key = credentials.apiKey || apiKey;
    const resolvedBaseUrl = normalizeProviderBaseUrl(provider, baseUrl);
    const compatibleHeaders = body.openAICompatible?.headers;

    switch (provider) {
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
        default:
            throw new Error(
                `${provider} does not expose an image-generation model through its SDK.`,
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
