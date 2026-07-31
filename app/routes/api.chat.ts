/**
 * API Chat Route — Vercel AI SDK UI message stream (assistant-ui / useChat)
 *
 * BYOK: API keys come from the client on every request — no server env secrets.
 * Tools run on this host (free search); LLM usage is billed to the user.
 */

import type { ActionFunctionArgs } from "react-router";
import {
    streamText,
    convertToModelMessages,
    stepCountIs,
    type UIMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { buildChatTools } from "~/lib/server/chat-tools";
import { closeMcpClients, loadMcpTools } from "~/lib/server/mcp-tools";
import { validateProviderEndpoint } from "~/lib/server/env";
import { buildChatSystemPrompt } from "~/lib/server/prompt";
import {
    buildReasoningProviderOptions,
    type ReasoningEffort,
} from "~/lib/reasoning";
import type { McpServerConfig, ProviderId } from "~/lib/types";

interface ChatRequestBody {
    messages: UIMessage[];
    model: string;
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
    systemPrompt?: string;
    system?: string;
    temperature?: number;
    maxTokens?: number | null;
    topP?: number;
    reasoningEffort?: ReasoningEffort;
    toolSettings?: {
        webSearchEnabled?: boolean;
        calculatorEnabled?: boolean;
        pythonEnabled?: boolean;
        webSearchEngine?: "duckduckgo" | "searxng";
        searxngUrl?: string;
        skillsEnabled?: boolean;
    };
    mcpServers?: McpServerConfig[];
}

function getModelInstance(body: ChatRequestBody) {
    const { provider, apiKey, baseUrl, model } = body;
    switch (provider) {
        case "openai":
            return createOpenAI({ apiKey, baseURL: baseUrl || undefined }).chat(
                model,
            );
        case "anthropic":
            return createAnthropic({ apiKey, baseURL: baseUrl || undefined })(
                model,
            );
        case "gemini":
            return createGoogleGenerativeAI({ apiKey })(model);
        case "groq":
            return createOpenAI({
                apiKey,
                baseURL: baseUrl || "https://api.groq.com/openai/v1",
            }).chat(model);
        case "xai":
            return createXai({
                apiKey,
                baseURL: baseUrl || "https://api.x.ai/v1",
            }).chat(model);
        case "openrouter":
            return createOpenAI({
                apiKey,
                baseURL: baseUrl || "https://openrouter.ai/api/v1",
            }).chat(model);
        case "ollama":
            return createOpenAI({
                apiKey: apiKey || "ollama",
                baseURL: baseUrl || "http://localhost:11434/v1",
            }).chat(model);
        case "custom":
            return createOpenAI({
                apiKey: apiKey || "custom",
                baseURL: baseUrl || "http://localhost:1234/v1",
            }).chat(model);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    let body: ChatRequestBody;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const endpointError = validateProviderEndpoint(
        body.provider,
        body.baseUrl,
    );
    if (endpointError) {
        return Response.json({ error: endpointError }, { status: 400 });
    }

    if (
        !body.apiKey &&
        body.provider !== "ollama" &&
        body.provider !== "custom"
    ) {
        return Response.json(
            { error: "API key required — add yours in Settings." },
            { status: 400 },
        );
    }

    if (!body.model) {
        return Response.json({ error: "Model required." }, { status: 400 });
    }

    if (!Array.isArray(body.messages)) {
        return Response.json({ error: "Messages required." }, { status: 400 });
    }

    const { tools: mcpTools, clients: mcpClients } = await loadMcpTools(
        body.mcpServers,
    );

    try {
        const modelInstance = getModelInstance(body);
        const builtIn = await buildChatTools(body.toolSettings ?? {});
        const tools = { ...builtIn, ...mcpTools };

        const modelMessages = await convertToModelMessages(body.messages);
        const effort = body.reasoningEffort ?? "medium";
        const providerOptions = buildReasoningProviderOptions(
            body.provider,
            body.model,
            effort,
        );

        const anthropicThinkingOn =
            body.provider === "anthropic" &&
            effort !== "off" &&
            Boolean(providerOptions?.anthropic);

        let maxOutputTokens = body.maxTokens ?? undefined;
        if (anthropicThinkingOn) {
            const budget =
                (providerOptions?.anthropic?.thinking as {
                    budgetTokens?: number;
                })?.budgetTokens ?? 8000;
            const floor = budget + 4096;
            if (maxOutputTokens == null || maxOutputTokens <= budget) {
                maxOutputTokens = floor;
            }
        }

        const result = streamText({
            model: modelInstance,
            messages: modelMessages,
            system: buildChatSystemPrompt(
                body.system || body.systemPrompt || undefined,
            ),
            ...(anthropicThinkingOn
                ? { temperature: 1 }
                : {
                      temperature: body.temperature ?? 0.7,
                      topP: body.topP ?? 1,
                  }),
            maxOutputTokens,
            tools: Object.keys(tools).length > 0 ? tools : undefined,
            stopWhen: stepCountIs(5),
            ...(providerOptions ? { providerOptions } : {}),
            onFinish: async () => {
                await closeMcpClients(mcpClients);
            },
        });

        return result.toUIMessageStreamResponse({
            sendReasoning: true,
            onError: (err) =>
                err instanceof Error ? err.message : "Unknown chat error",
        });
    } catch (err) {
        await closeMcpClients(mcpClients);
        const errorMsg =
            err instanceof Error ? err.message : "Unknown server error";
        console.error("[api/chat]", err);
        return Response.json({ error: errorMsg }, { status: 500 });
    }
}
