import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
    streamText,
    convertToModelMessages,
    stepCountIs,
    type UIMessage,
} from "ai";
import { buildChatTools } from "~/lib/server/chat-tools";
import { closeMcpClients, loadMcpTools } from "~/lib/server/mcp-tools";
import { buildChatSystemPrompt } from "~/lib/server/prompt";
import {
    buildReasoningProviderOptions,
    type ReasoningEffort,
} from "~/lib/reasoning";
import type { McpServerConfig, ProviderId } from "~/lib/types";
import { createChatModel } from "~/lib/server/model";
import { providerNeedsKey } from "~/lib/provider-credentials";
import { corsPreflight, withCors } from "~/lib/server/cors";

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

export function loader({ request }: LoaderFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    return withCors(
        request,
        new Response("Method Not Allowed", { status: 405 }),
    );
}

export async function action({ request }: ActionFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;

    if (request.method !== "POST") {
        return withCors(
            request,
            new Response("Method Not Allowed", { status: 405 }),
        );
    }

    let body: ChatRequestBody;
    try {
        body = await request.json();
    } catch {
        return withCors(
            request,
            Response.json({ error: "Invalid JSON body" }, { status: 400 }),
        );
    }

    if (providerNeedsKey(body.provider) && !body.apiKey) {
        return withCors(
            request,
            Response.json(
                { error: "API key required — add yours in Settings." },
                { status: 400 },
            ),
        );
    }

    if (!body.model) {
        return withCors(
            request,
            Response.json({ error: "Model required." }, { status: 400 }),
        );
    }

    if (!Array.isArray(body.messages)) {
        return withCors(
            request,
            Response.json({ error: "Messages required." }, { status: 400 }),
        );
    }

    const { tools: mcpTools, clients: mcpClients } = await loadMcpTools(
        body.mcpServers,
    );

    try {
        const modelInstance = createChatModel(body);
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

        return withCors(
            request,
            result.toUIMessageStreamResponse({
                sendReasoning: true,
                onError: (err) =>
                    err instanceof Error ? err.message : "Unknown chat error",
            }),
        );
    } catch (err) {
        await closeMcpClients(mcpClients);
        const errorMsg =
            err instanceof Error ? err.message : "Unknown server error";
        console.error("[api/chat]", err);
        return withCors(
            request,
            Response.json({ error: errorMsg }, { status: 500 }),
        );
    }
}
