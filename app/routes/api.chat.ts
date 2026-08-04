import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
    streamText,
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    generateImage,
    generateSpeech,
    experimental_generateVideo,
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
import type { ConnectorConfig, McpServerConfig, ProviderId } from "~/lib/types";
import {
    createChatModel,
    createImageModel,
    createSpeechModel,
    createVideoModel,
    shouldUseOpenAIResponses,
} from "~/lib/server/model";
import {
    inferModelSupportsImageGeneration,
    inferModelSupportsAudioOutput,
    inferModelSupportsVideo,
} from "~/lib/model-capabilities";
import { imageRequestOptions } from "~/lib/image-generation";
import { providerNeedsKey } from "~/lib/provider-credentials";
import { corsPreflight, withCors } from "~/lib/server/cors";
import { normalizeProviderBaseUrl } from "~/lib/server/provider-url";

interface ChatRequestBody {
    messages: UIMessage[];
    model: string;
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
    systemPrompt?: string;
    system?: string;
    projectInstructions?: string;
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
        connectors?: ConnectorConfig[];
        memoryAvailable?: boolean;
        subagentsEnabled?: boolean;
    };
    mcpServers?: McpServerConfig[];
    imageSettings?: {
        size?: "1024x1024" | "1536x1024" | "1024x1536";
        count?: number;
    };
    memoryContext?: string;
    customSkill?: { name: string; content: string };
    /** Active agent persona whose instructions apply for this conversation. */
    agent?: { name: string; content: string };
    /** When true the request runs as a delegated subagent (no ask_user/spawn_subagent). */
    subagentMode?: boolean;
    openAICompatible?: {
        apiMode: "auto" | "chat" | "responses";
        reasoningWithTools: "auto" | "none" | "allow";
        headers?: Record<string, string>;
        timeoutMs?: number;
        maxRetries?: number;
        authMode?: "bearer" | "api-key-header" | "custom-header" | "none";
        capabilityOverrides?: {
            tools?: boolean;
            vision?: boolean;
            structuredOutput?: boolean;
            reasoning?: boolean;
            embeddings?: boolean;
            parallelTools?: boolean;
        };
    };
}

function imagePrompt(messages: UIMessage[]): string {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    return (
        lastUser?.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join(" ")
            .trim() || "Generate an image based on the conversation."
    );
}

function publicChatError(error: unknown): string {
    const message = error instanceof Error ? error.message : "";
    if (/only http\(s\)|valid http\(s\)|credentials must not be embedded|private.*not allowed/i.test(message)) {
        return message;
    }
    if (/invalid|unauthorized|forbidden|api key|authentication/i.test(message)) {
        return "Provider authentication failed. Check the API key and permissions.";
    }
    if (/model.*not found|not found.*model/i.test(message)) {
        return "The selected model was not found by this provider.";
    }
    if (/rate limit|\b429\b/i.test(message)) {
        return "The provider rate limit was reached. Wait and try again.";
    }
    if (/timeout|timed out|network|fetch failed|econn/i.test(message)) {
        return "Could not reach the provider. Check the API root and network connection.";
    }
    return "Provider request failed. Check the selected model and provider compatibility.";
}

async function generateImageResponse(body: ChatRequestBody): Promise<Response> {
    const imageOptions = imageRequestOptions(
        body.provider,
        body.imageSettings?.size,
        body.imageSettings?.count,
    );
    const result = await generateImage({
        model: createImageModel(body),
        prompt: imagePrompt(body.messages),
        ...imageOptions,
    });

    const stream = createUIMessageStream({
        execute({ writer }) {
            writer.write({ type: "start" });
            for (const image of result.images) {
                writer.write({
                    type: "file",
                    url: `data:${image.mediaType};base64,${image.base64}`,
                    mediaType: image.mediaType,
                });
            }
            writer.write({ type: "finish", finishReason: "stop" });
        },
        onError: (error) =>
            error instanceof Error ? error.message : "Image generation failed",
    });

    return createUIMessageStreamResponse({ stream });
}

async function generateVideoResponse(body: ChatRequestBody): Promise<Response> {
    const result = await experimental_generateVideo({
        model: createVideoModel(body),
        prompt: imagePrompt(body.messages),
    });

    const stream = createUIMessageStream({
        execute({ writer }) {
            writer.write({ type: "start" });
            for (const video of result.videos) {
                writer.write({
                    type: "file",
                    url: `data:${video.mediaType};base64,${video.base64}`,
                    mediaType: video.mediaType,
                });
            }
            writer.write({ type: "finish", finishReason: "stop" });
        },
        onError: (error) =>
            error instanceof Error ? error.message : "Video generation failed",
    });

    return createUIMessageStreamResponse({ stream });
}

async function generateAudioResponse(body: ChatRequestBody): Promise<Response> {
    const result = await generateSpeech({
        model: createSpeechModel(body),
        text: imagePrompt(body.messages),
        outputFormat: "mp3",
    });

    const stream = createUIMessageStream({
        execute({ writer }) {
            writer.write({ type: "start" });
            writer.write({
                type: "file",
                url: `data:${result.audio.mediaType};base64,${result.audio.base64}`,
                mediaType: result.audio.mediaType,
            });
            writer.write({ type: "finish", finishReason: "stop" });
        },
        onError: (error) =>
            error instanceof Error ? error.message : "Audio generation failed",
    });

    return createUIMessageStreamResponse({ stream });
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

    try {
        body.baseUrl = normalizeProviderBaseUrl(body.provider, body.baseUrl);
    } catch (err) {
        return withCors(
            request,
            Response.json(
                { error: err instanceof Error ? err.message : "Invalid provider URL" },
                { status: 400 },
            ),
        );
    }

    if (
        body.subagentMode !== true &&
        inferModelSupportsAudioOutput(body.model, body.provider)
    ) {
        try {
            return withCors(request, await generateAudioResponse(body));
        } catch (err) {
            const message = publicChatError(err);
            console.error("[api/chat:audio]", message);
            return withCors(
                request,
                Response.json({ error: message }, { status: 500 }),
            );
        }
    }

    if (
        body.subagentMode !== true &&
        inferModelSupportsVideo(body.model, body.provider)
    ) {
        try {
            return withCors(request, await generateVideoResponse(body));
        } catch (err) {
            const message = publicChatError(err);
            console.error("[api/chat:video]", message);
            return withCors(
                request,
                Response.json({ error: message }, { status: 500 }),
            );
        }
    }

    if (
        body.subagentMode !== true &&
        inferModelSupportsImageGeneration(body.model, body.provider)
    ) {
        try {
            return withCors(request, await generateImageResponse(body));
        } catch (err) {
            const message = publicChatError(err);
            console.error("[api/chat:image]", message);
            return withCors(
                request,
                Response.json({ error: message }, { status: 500 }),
            );
        }
    }

    let mcpTools = {};
    let mcpClients: Awaited<ReturnType<typeof loadMcpTools>>["clients"] = [];

    try {
        const loadedMcp = await loadMcpTools(body.mcpServers);
        mcpTools = loadedMcp.tools;
        mcpClients = loadedMcp.clients;
        const modelInstance = createChatModel(body);
        const builtIn = await buildChatTools(body.toolSettings ?? {}, {
            subagentMode: body.subagentMode === true,
        });
        const tools =
            body.openAICompatible?.capabilityOverrides?.tools === false
                ? {}
                : { ...builtIn, ...mcpTools };

        const modelMessages = await convertToModelMessages(body.messages);
        const effort = body.reasoningEffort ?? "medium";
        const providerOptions = buildReasoningProviderOptions(
            body.provider,
            body.model,
            effort,
        );
        const toolsEnabled = Object.keys(tools).length > 0;
        const safeProviderOptions =
            toolsEnabled &&
            body.openAICompatible?.reasoningWithTools !== "allow" &&
            !shouldUseOpenAIResponses(
                body.provider,
                body.model,
                body.baseUrl,
                body.openAICompatible,
            ) &&
            providerOptions?.openai
                ? {
                      ...providerOptions,
                      openai: {
                          ...providerOptions.openai,
                          reasoningEffort: "none" as const,
                      },
                  }
                : providerOptions;

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
                body.memoryContext,
                body.customSkill,
                body.subagentMode === true ? "subagent" : "main",
                body.projectInstructions,
                body.agent,
            ),
            ...(anthropicThinkingOn
                ? { temperature: 1 }
                : {
                      temperature: body.temperature ?? 0.7,
                      topP: body.topP ?? 1,
                  }),
            maxOutputTokens,
            tools: Object.keys(tools).length > 0 ? tools : undefined,
            // Five steps is too easy to exhaust with repeated searches or a
            // tool call followed by a correction. Keep a finite guard while
            // leaving room for substantial multi-tool work to finish.
            stopWhen: stepCountIs(20),
            ...(safeProviderOptions ? { providerOptions: safeProviderOptions } : {}),
            onFinish: async () => {
                await closeMcpClients(mcpClients);
            },
        });

        return withCors(
            request,
            result.toUIMessageStreamResponse({
                sendReasoning: true,
                onError: publicChatError,
                // Attach real provider-reported usage plus the model/provider
                // used for this request to the assistant message metadata so
                // the client can persist and aggregate it (usage analytics).
                messageMetadata: ({ part }) =>
                    part.type === "finish"
                        ? {
                              usage: part.totalUsage,
                              model: body.model,
                              provider: body.provider,
                          }
                        : undefined,
            }),
        );
    } catch (err) {
        await closeMcpClients(mcpClients);
        const errorMsg = publicChatError(err);
        console.error("[api/chat]", errorMsg);
        return withCors(
            request,
            Response.json({ error: errorMsg }, { status: 500 }),
        );
    }
}
