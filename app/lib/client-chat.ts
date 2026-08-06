import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { AnthropicProvider } from "~/lib/llm/anthropic";
import { GeminiProvider } from "~/lib/llm/gemini";
import { OpenAIProvider } from "~/lib/llm/openai";
import type { ChatMessage, LLMProvider, LLMTool } from "~/lib/llm/types";
import type { ProviderId } from "~/lib/types";
import { CALCULATOR_TOOL, FETCH_URL_TOOL, WEB_SEARCH_TOOL } from "~/lib/tools";

type ChatBody = {
    messages?: Array<{
        role?: string;
        parts?: Array<Record<string, unknown>>;
        content?: string;
    }>;
    provider?: ProviderId;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    systemPrompt?: string;
    projectInstructions?: string;
    memoryContext?: string;
    knowledgeContext?: string;
    customSkill?: { content?: string };
    agent?: { content?: string };
    temperature?: number;
    maxTokens?: number | null;
    topP?: number;
    subagentMode?: boolean;
    toolSettings?: {
        pythonEnabled?: boolean;
        memoryAvailable?: boolean;
        knowledgeAvailable?: boolean;
        subagentsEnabled?: boolean;
        webSearchEnabled?: boolean;
        calculatorEnabled?: boolean;
    };
};

const OPENAI_COMPATIBLE_PROVIDERS = new Set<ProviderId>([
    "openai",
    "groq",
    "openrouter",
    "xai",
    "deepseek",
    "togetherai",
    "mistral",
    "huggingface",
    "ollama",
    "lmstudio",
    "gateway",
    "custom",
]);

export function getClientProvider(provider: ProviderId): LLMProvider {
    if (OPENAI_COMPATIBLE_PROVIDERS.has(provider)) return new OpenAIProvider(provider);
    if (provider === "anthropic") return new AnthropicProvider();
    if (provider === "gemini") return new GeminiProvider();
    throw new Error(`${provider} chat is not yet supported in the browser-direct build. Use OpenAI-compatible, Anthropic, or Gemini providers, or self-host for full adapter support.`);
}

export async function listClientModels(
    provider: ProviderId,
    apiKey: string,
    baseUrl?: string,
    headers?: Record<string, string>,
    timeoutMs?: number,
    maxRetries?: number,
    authMode?: "bearer" | "api-key-header" | "custom-header" | "none",
): Promise<Array<{ id: string; name: string }>> {
    return getClientProvider(provider).listModels(apiKey, baseUrl, headers, timeoutMs, maxRetries, authMode);
}

export async function localChatFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    if (!url.endsWith("local://chat")) return globalThis.fetch(input, init);

    let body: ChatBody;
    try {
        body = JSON.parse(String(init?.body ?? "{}")) as ChatBody;
    } catch {
        return Response.json({ error: "Invalid chat request." }, { status: 400 });
    }

    const stream = createUIMessageStream({
        execute: async ({ writer }) => {
            const messageId = `local_${Date.now().toString(36)}`;
            writer.write({ type: "start", messageId });
            writer.write({ type: "start-step" });
            writer.write({ type: "text-start", id: "text-1" });

            try {
                const provider = body.provider;
                const model = body.model?.trim();
                if (!provider || !model) throw new Error("Choose a provider and model first.");

                const adapter = getClientProvider(provider);
                const toolCalls = new Set<string>();
                let reasoningStarted = false;
                await adapter.streamChat(
                    {
                        messages: toChatMessages(body.messages ?? []),
                        provider,
                        apiKey: body.apiKey ?? "",
                        baseUrl: body.baseUrl,
                        model,
                        systemPrompt: buildSystemPrompt(body),
                        temperature: body.temperature,
                        maxTokens: body.maxTokens,
                        topP: body.topP,
                        tools: buildClientTools(body),
                        signal: init?.signal ?? undefined,
                    },
                    {
                        onText: (text) => writer.write({ type: "text-delta", id: "text-1", delta: text }),
                        onReasoning: (text) => {
                            if (!reasoningStarted) {
                                reasoningStarted = true;
                                writer.write({ type: "reasoning-start", id: "reasoning-1" });
                            }
                            writer.write({ type: "reasoning-delta", id: "reasoning-1", delta: text });
                        },
                        onToolCall: ({ id, name, args }) => {
                            if (toolCalls.has(id)) return;
                            toolCalls.add(id);
                            writer.write({ type: "tool-input-start", toolCallId: id, toolName: name });
                            writer.write({ type: "tool-input-available", toolCallId: id, toolName: name, input: args });
                        },
                    },
                );
                if (reasoningStarted) writer.write({ type: "reasoning-end", id: "reasoning-1" });
                writer.write({ type: "text-end", id: "text-1" });
                writer.write({ type: "finish-step" });
                writer.write({ type: "finish", finishReason: toolCalls.size > 0 ? "tool-calls" : "stop" });
            } catch (error) {
                writer.write({
                    type: "error",
                    errorText: error instanceof Error ? error.message : "Local provider request failed.",
                });
            }
        },
        onError: (error) => (error instanceof Error ? error.message : "Local provider request failed."),
    });

    return createUIMessageStreamResponse({ stream });
}

function buildSystemPrompt(body: ChatBody): string | undefined {
    const sections = [
        body.systemPrompt,
        body.projectInstructions,
        body.agent?.content,
        body.customSkill?.content,
        body.memoryContext,
        body.knowledgeContext,
    ].filter((value): value is string => Boolean(value?.trim()));
    return sections.length > 0 ? sections.join("\n\n") : undefined;
}

function toChatMessages(messages: NonNullable<ChatBody["messages"]>): ChatMessage[] {
    const output: ChatMessage[] = [];
    for (const message of messages) {
        const role = message.role === "assistant" || message.role === "system" ? message.role : "user";
        const parts = message.parts ?? [];
        const text = parts
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => String(part.text))
            .join("");
        const toolParts = parts.filter((part) => typeof part.toolCallId === "string");
        const toolCalls = toolParts
            .filter((part) => part.type?.toString().startsWith("tool-") && part.input !== undefined)
            .map((part) => ({
                id: String(part.toolCallId),
                type: "function" as const,
                function: {
                    name: String(part.toolName ?? "tool"),
                    arguments: JSON.stringify(part.input ?? {}),
                },
            }));

        output.push({
            role,
            content: text || (typeof message.content === "string" ? message.content : ""),
            ...(role === "assistant" && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        });

        for (const part of toolParts) {
            if (part.state === "output-available") {
                output.push({
                    role: "tool",
                    tool_call_id: String(part.toolCallId),
                    content: typeof part.output === "string" ? part.output : JSON.stringify(part.output ?? ""),
                });
            }
        }
    }
    return output;
}

function buildClientTools(body: ChatBody): LLMTool[] {
    const tools: LLMTool[] = [];
    const add = (name: string, description: string, parameters: Record<string, unknown>) =>
        tools.push({ type: "function", function: { name, description, parameters } });

    if (body.toolSettings?.pythonEnabled) {
        add("run_python", "Execute Python in the browser and return its output.", {
            type: "object",
            properties: { code: { type: "string" }, description: { type: "string" } },
            required: ["code"],
        });
    }
    if (body.toolSettings?.memoryAvailable) {
        add("memory", "Read relevant user-approved local memory from the browser.", {
            type: "object",
            properties: { query: { type: "string" } },
        });
    }
    if (body.toolSettings?.knowledgeAvailable) {
        add("knowledge_search", "Search documents indexed in the browser's local knowledge store.", {
            type: "object",
            properties: { query: { type: "string" }, limit: { type: "number" } },
            required: ["query"],
        });
    }
    if (body.subagentMode !== true) {
        add("ask_user", "Ask the user a focused question when required information cannot be inferred.", {
            type: "object",
            properties: {
                question: { type: "string" },
                questionType: { type: "string", enum: ["single", "multiple", "short"] },
                options: { type: "array", items: { type: "string" } },
            },
            required: ["question"],
        });
    }
    if (body.toolSettings?.subagentsEnabled && body.subagentMode !== true) {
        add("spawn_subagent", "Delegate a focused task to the browser subagent UI.", {
            type: "object",
            properties: { task: { type: "string" } },
            required: ["task"],
        });
    }
    if (body.toolSettings?.webSearchEnabled) {
        tools.push(WEB_SEARCH_TOOL);
        tools.push(FETCH_URL_TOOL);
    }
    if (body.toolSettings?.calculatorEnabled) {
        tools.push(CALCULATOR_TOOL);
    }
    return tools;
}
