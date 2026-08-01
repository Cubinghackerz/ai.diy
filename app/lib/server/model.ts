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
import type { ProviderId } from "~/lib/types";
import { parseProviderCredentials } from "~/lib/provider-credentials";

export type ModelRequest = {
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
    model: string;
};

export function createChatModel(body: ModelRequest) {
    const { provider, apiKey, baseUrl, model } = body;
    const credentials = parseProviderCredentials(provider, apiKey);
    const key = credentials.apiKey || apiKey;

    switch (provider) {
        case "openai":
            return createOpenAI({ apiKey: key, baseURL: baseUrl || undefined }).chat(model);
        case "anthropic":
            return createAnthropic({ apiKey: key, baseURL: baseUrl || undefined })(model);
        case "gemini":
            return createGoogleGenerativeAI({ apiKey: key })(model);
        case "groq":
            return createOpenAI({ apiKey: key, baseURL: baseUrl || "https://api.groq.com/openai/v1" }).chat(model);
        case "xai":
            return createXai({ apiKey: key, baseURL: baseUrl || "https://api.x.ai/v1" }).chat(model);
        case "openrouter":
            return createOpenAI({ apiKey: key, baseURL: baseUrl || "https://openrouter.ai/api/v1" }).chat(model);
        case "deepseek":
            return createDeepSeek({ apiKey: key, baseURL: baseUrl || undefined }).chat(model);
        case "bedrock":
            return createAmazonBedrock({
                apiKey: credentials.apiKey,
                region: credentials.region,
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
                sessionToken: credentials.sessionToken,
                baseURL: baseUrl || credentials.baseURL || undefined,
            })(model);
        case "azure":
            return createAzure({
                apiKey: credentials.apiKey,
                resourceName: credentials.resourceName,
                apiVersion: credentials.apiVersion,
                baseURL: baseUrl || credentials.baseURL || undefined,
            }).chat(model);
        case "vertex":
            return createGoogleVertex({
                apiKey: credentials.apiKey,
                project: credentials.project,
                location: credentials.location,
                baseURL: baseUrl || credentials.baseURL || undefined,
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
                baseURL: baseUrl || undefined,
            }).chat(model);
        case "togetherai":
            return createTogetherAI({ apiKey: key, baseURL: baseUrl || undefined })(model);
        case "mistral":
            return createMistral({ apiKey: key, baseURL: baseUrl || undefined }).chat(model);
        case "huggingface":
            return createHuggingFace({ apiKey: key, baseURL: baseUrl || undefined })(model);
        case "ollama":
            return createOpenAI({ apiKey: key || "ollama", baseURL: baseUrl || "http://localhost:11434/v1" }).chat(model);
        case "lmstudio":
            return createOpenAI({ apiKey: key || "lmstudio", baseURL: baseUrl || "http://localhost:1234/v1" }).chat(model);
        case "custom":
            return createOpenAI({ apiKey: key || "custom", baseURL: baseUrl || "http://localhost:1234/v1" }).chat(model);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

export function createImageModel(body: ModelRequest): ImageModel {
    const { provider, apiKey, baseUrl, model } = body;
    const credentials = parseProviderCredentials(provider, apiKey);
    const key = credentials.apiKey || apiKey;

    switch (provider) {
        case "openai":
        case "openrouter":
        case "custom":
            return createOpenAI({
                apiKey: key,
                baseURL: baseUrl || undefined,
            }).imageModel(model);
        case "xai":
            return createXai({
                apiKey: key,
                baseURL: baseUrl || undefined,
            }).imageModel(model);
        case "gemini":
            return createGoogleGenerativeAI({ apiKey: key }).image(model);
        case "gateway":
            return createGateway({
                apiKey: key,
                baseURL: baseUrl || undefined,
            }).imageModel(model);
        case "bedrock":
            return createAmazonBedrock({
                apiKey: credentials.apiKey,
                region: credentials.region,
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
                sessionToken: credentials.sessionToken,
                baseURL: baseUrl || credentials.baseURL || undefined,
            }).image(model);
        case "azure":
            return createAzure({
                apiKey: credentials.apiKey,
                resourceName: credentials.resourceName,
                apiVersion: credentials.apiVersion,
                baseURL: baseUrl || credentials.baseURL || undefined,
            }).imageModel(model);
        case "vertex":
            return createGoogleVertex({
                apiKey: credentials.apiKey,
                project: credentials.project,
                location: credentials.location,
                baseURL: baseUrl || credentials.baseURL || undefined,
            }).imageModel(model);
        case "togetherai":
            return createTogetherAI({
                apiKey: key,
                baseURL: baseUrl || undefined,
            }).imageModel(model);
        default:
            throw new Error(
                `${provider} does not expose an image-generation model through its SDK.`,
            );
    }
}
