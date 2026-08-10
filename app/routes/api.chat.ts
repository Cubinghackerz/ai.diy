import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
    streamText,
    generateText,
    convertToModelMessages,
    createUIMessageStream,
    createUIMessageStreamResponse,
    generateImage,
    generateSpeech,
    experimental_generateVideo,
    stepCountIs,
    type UIMessage,
} from "ai";
import { createChatGPTProxyProvider } from "@opencoredev/loginwithchatgpt-ai";
import { buildChatTools } from "~/lib/server/chat-tools";
import { closeMcpClients, loadMcpTools } from "~/lib/server/mcp-tools";
import { buildChatSystemPromptParts } from "~/lib/server/prompt";
import {
    ensureCompactionSkill,
    ensureFrontendSkill,
    ensureResearchSkill,
    lastUserTextFromMessages,
    resolveRequiredSkillTools,
    type ForcedSkill,
} from "~/lib/skill-command";
import {
    compactUiMessages,
    estimateTokensFromText,
    resolveModelContextWindow,
} from "~/lib/server/context-compaction";
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
import { getChatGPTHandler } from "~/lib/server/chatgpt-auth";
import { normalizeProviderBaseUrl } from "~/lib/server/provider-url";
import {
    formatProviderError,
    httpStatusForProviderError,
    classifyProviderError,
} from "~/lib/provider-errors";
import {
    normalizeTokenMode,
    providerSupportsExplicitCache,
    tokenModePolicy,
    type TokenMode,
} from "~/lib/token-mode";
import {
    checkRateLimit,
    rateLimitKeyFromRequest,
    rateLimitResponse,
} from "~/lib/server/rate-limit";

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
        knowledgeEnabled?: boolean;
        subagentsEnabled?: boolean;
        tokenMode?: TokenMode;
    };
    mcpServers?: McpServerConfig[];
    imageSettings?: {
        size?: "1024x1024" | "1536x1024" | "1024x1536";
        count?: number;
    };
    memoryContext?: string;
    customSkills?: { name: string; content: string }[];
    /** When true the request runs as a delegated subagent (no ask_user/spawn_subagent). */
    subagentMode?: boolean;
    /** Agent Mode: plan → skills/tools → verify → synthesize. */
    agentMode?: boolean;
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

function publicChatError(error: unknown, provider?: string): string {
    return formatProviderError(error, { provider, context: "chat" });
}

async function generateImageResponse(
    body: ChatRequestBody,
    abortSignal: AbortSignal,
    request?: Request,
): Promise<Response> {
    if (body.provider === "chatgpt") {
        return generateChatGPTImageResponse(body, abortSignal, request);
    }
    const imageOptions = imageRequestOptions(
        body.provider,
        body.imageSettings?.size,
        body.imageSettings?.count,
    );
    const result = await generateImage({
        model: createImageModel(body),
        prompt: imagePrompt(body.messages),
        abortSignal,
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

/**
 * ChatGPT subscription image path — uses the session proxy Responses model.
 * Dedicated Images API is not exposed by loginwithchatgpt 0.2.x; we ask the
 * selected model and surface any returned file parts.
 */
async function generateChatGPTImageResponse(
    body: ChatRequestBody,
    abortSignal: AbortSignal,
    request?: Request,
): Promise<Response> {
    if (!request) {
        throw new Error("ChatGPT image generation requires an HTTP request context.");
    }
    const session = await getChatGPTHandler().getSession(request);
    if (session.status !== "authenticated") {
        throw new Error("Sign in with ChatGPT to generate images on your subscription.");
    }

    const chatgpt = createChatGPTProxyProvider({
        fetch: getChatGPTHandler().proxyFetch(request),
    });
    const prompt = imagePrompt(body.messages);
    const result = await generateText({
        model: chatgpt(body.model),
        prompt: `Generate an image for this request and return the image as a file attachment.\n\n${prompt}`,
        abortSignal,
    });

    const files = (
        result as {
            files?: Array<{ mediaType?: string; base64?: string; uint8Array?: Uint8Array }>;
        }
    ).files;

    if (!files?.length) {
        const text = result.text?.trim();
        if (text) {
            const stream = createUIMessageStream({
                execute({ writer }) {
                    writer.write({ type: "start" });
                    writer.write({ type: "text-start", id: "img-note" });
                    writer.write({
                        type: "text-delta",
                        id: "img-note",
                        delta: text,
                    });
                    writer.write({ type: "text-end", id: "img-note" });
                    writer.write({ type: "finish", finishReason: "stop" });
                },
            });
            return createUIMessageStreamResponse({ stream });
        }
        throw new Error(
            "This ChatGPT model did not return an image file. Try a different model from your account, or use OpenAI (API key) for dedicated image models.",
        );
    }

    const stream = createUIMessageStream({
        execute({ writer }) {
            writer.write({ type: "start" });
            for (const file of files) {
                const mediaType = file.mediaType || "image/png";
                const base64 =
                    file.base64 ||
                    (file.uint8Array
                        ? Buffer.from(file.uint8Array).toString("base64")
                        : "");
                if (!base64) continue;
                writer.write({
                    type: "file",
                    url: `data:${mediaType};base64,${base64}`,
                    mediaType,
                });
            }
            writer.write({ type: "finish", finishReason: "stop" });
        },
        onError: (error) =>
            error instanceof Error ? error.message : "Image generation failed",
    });

    return createUIMessageStreamResponse({ stream });
}

async function generateVideoResponse(
    body: ChatRequestBody,
    abortSignal: AbortSignal,
): Promise<Response> {
    const result = await experimental_generateVideo({
        model: createVideoModel(body),
        prompt: imagePrompt(body.messages),
        abortSignal,
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

async function generateAudioResponse(
    body: ChatRequestBody,
    abortSignal: AbortSignal,
): Promise<Response> {
    const result = await generateSpeech({
        model: createSpeechModel(body),
        text: imagePrompt(body.messages),
        outputFormat: "mp3",
        abortSignal,
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

    const rateKey = rateLimitKeyFromRequest(
        request,
        body.provider === "chatgpt" ? "chatgpt-subscription" : body.apiKey,
    );
    const rateCheck = checkRateLimit(rateKey);
    if (!rateCheck.ok) {
        return withCors(request, rateLimitResponse(rateCheck.retryAfterMs));
    }

    if (body.provider === "chatgpt") {
        const session = await getChatGPTHandler().getSession(request);
        if (session.status !== "authenticated") {
            return withCors(
                request,
                Response.json(
                    {
                        error: formatProviderError(
                            "Sign in with ChatGPT under Settings → Experimental before using the ChatGPT (subscription) provider.",
                            { provider: "chatgpt", context: "chat" },
                        ),
                    },
                    { status: 401 },
                ),
            );
        }
    } else if (providerNeedsKey(body.provider) && !body.apiKey) {
        const payload = {
            error: formatProviderError("API key required", {
                provider: body.provider,
                context: "chat",
            }),
        };
        return withCors(
            request,
            Response.json(payload, { status: 400 }),
        );
    }

    if (!body.model) {
        return withCors(
            request,
            Response.json(
                {
                    error: formatProviderError("Model required", {
                        provider: body.provider,
                        context: "chat",
                    }),
                },
                { status: 400 },
            ),
        );
    }

    if (!Array.isArray(body.messages)) {
        return withCors(
            request,
            Response.json(
                {
                    error: formatProviderError("Messages required", {
                        provider: body.provider,
                        context: "chat",
                    }),
                },
                { status: 400 },
            ),
        );
    }

    try {
        body.baseUrl = normalizeProviderBaseUrl(body.provider, body.baseUrl);
    } catch (err) {
        return withCors(
            request,
            Response.json(
                {
                    error: formatProviderError(err, {
                        provider: body.provider,
                        context: "chat",
                    }),
                },
                { status: 400 },
            ),
        );
    }

    if (
        body.subagentMode !== true &&
        inferModelSupportsAudioOutput(body.model, body.provider)
    ) {
        try {
            return withCors(request, await generateAudioResponse(body, request.signal));
        } catch (err) {
            const message = publicChatError(err, body.provider);
            const kind = classifyProviderError(err, {
                provider: body.provider,
                context: "chat",
            }).kind;
            console.error("[api/chat:audio]", message.split("\n")[0]);
            return withCors(
                request,
                Response.json({ error: message }, { status: httpStatusForProviderError(kind) }),
            );
        }
    }

    if (
        body.subagentMode !== true &&
        inferModelSupportsVideo(body.model, body.provider)
    ) {
        try {
            return withCors(request, await generateVideoResponse(body, request.signal));
        } catch (err) {
            const message = publicChatError(err, body.provider);
            const kind = classifyProviderError(err, {
                provider: body.provider,
                context: "chat",
            }).kind;
            console.error("[api/chat:video]", message.split("\n")[0]);
            return withCors(
                request,
                Response.json({ error: message }, { status: httpStatusForProviderError(kind) }),
            );
        }
    }

    if (
        body.subagentMode !== true &&
        inferModelSupportsImageGeneration(body.model, body.provider)
    ) {
        try {
            return withCors(request, await generateImageResponse(body, request.signal, request));
        } catch (err) {
            const message = publicChatError(err, body.provider);
            const kind = classifyProviderError(err, {
                provider: body.provider,
                context: "chat",
            }).kind;
            console.error("[api/chat:image]", message.split("\n")[0]);
            return withCors(
                request,
                Response.json({ error: message }, { status: httpStatusForProviderError(kind) }),
            );
        }
    }

    let mcpTools = {};
    let mcpClients: Awaited<ReturnType<typeof loadMcpTools>>["clients"] = [];
    let mcpClosed = false;
    const closeLoadedMcp = async () => {
        if (mcpClosed) return;
        mcpClosed = true;
        await closeMcpClients(mcpClients);
    };

    try {
        const mode = normalizeTokenMode(body.toolSettings?.tokenMode);
        const policy = tokenModePolicy(mode);

        const loadedMcp = await loadMcpTools(body.mcpServers, policy);
        mcpTools = loadedMcp.tools;
        mcpClients = loadedMcp.clients;
        const modelInstance = createChatModel({ ...body, request });
        const mcpSearchAvailable = Object.keys(mcpTools).some((name) =>
            /^mcp_(?:parallel_search_mcp_(?:web_search|web_fetch)|firecrawl_keyless_firecrawl_(?:search|scrape|parse))$/i.test(name),
        );

        // Slash-selected skills + auto Research / Frontend when intent is clear.
        const userText = lastUserTextFromMessages(body.messages);
        const activeSkills: ForcedSkill[] = ensureCompactionSkill(
            ensureFrontendSkill(
                ensureResearchSkill(body.customSkills, userText, {
                    webSearchEnabled: body.toolSettings?.webSearchEnabled,
                }),
                userText,
            ),
            userText,
        );
        const requiredSkillTools = resolveRequiredSkillTools(activeSkills);

        const builtIn = await buildChatTools(
            {
                ...(body.toolSettings ?? {}),
                forceToolNames: requiredSkillTools,
            },
            {
                subagentMode: body.subagentMode === true,
                suppressWebSearch: mcpSearchAvailable,
                messages: body.messages,
            },
        );
        const tools =
            body.openAICompatible?.capabilityOverrides?.tools === false
                ? {}
                : { ...builtIn, ...mcpTools };

        const forceCompaction = requiredSkillTools.includes("compaction_skill");
        const contextWindow = resolveModelContextWindow(body.provider, body.model);
        const reserveTokens = Math.max(2_048, body.maxTokens ?? 4_096);
        // Draft prompt length for budget estimate (tools reminder added after).
        const draftPromptParts = buildChatSystemPromptParts(
            body.system || body.systemPrompt || undefined,
            body.memoryContext,
            activeSkills,
            body.subagentMode === true ? "subagent" : "main",
            body.projectInstructions,
            body.agentMode === true,
            mode,
            Object.keys(tools),
        );
        // Auto-compact only near the context limit. Forced /Compaction must call
        // compaction_skill instead of silently rewriting history into plain text.
        const compacted = compactUiMessages(body.messages, {
            contextWindow,
            reserveTokens,
            systemTokens: estimateTokensFromText(draftPromptParts.full),
            force: false,
            reason: "auto context limit",
            keepRecent: 8,
        });
        const promptMessages = forceCompaction ? body.messages : compacted.messages;

        const promptParts = buildChatSystemPromptParts(
            body.system || body.systemPrompt || undefined,
            body.memoryContext,
            activeSkills,
            body.subagentMode === true ? "subagent" : "main",
            body.projectInstructions,
            body.agentMode === true,
            mode,
            Object.keys(tools),
        );

        const modelMessages = await convertToModelMessages(promptMessages);
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

        // Prompt-caching mode: stable prefix first (explicit cache_control on
        // Anthropic-family providers). OpenAI-style automatic prefix caches
        // also benefit because the large static block leads the prompt.
        const useExplicitCache =
            policy.promptCaching &&
            providerSupportsExplicitCache(body.provider);
        const cachedMessages = policy.promptCaching
            ? [
                  {
                      role: "system" as const,
                      content: promptParts.stable,
                      ...(useExplicitCache
                          ? {
                                providerOptions: {
                                    anthropic: {
                                        cacheControl: {
                                            type: "ephemeral" as const,
                                        },
                                    },
                                },
                            }
                          : {}),
                  },
                  ...(promptParts.volatile.trim()
                      ? [
                            {
                                role: "system" as const,
                                content: promptParts.volatile,
                            },
                        ]
                      : []),
                  ...modelMessages,
              ]
            : modelMessages;

        // Mark the last built-in tool so Anthropic can cache tool schemas too.
        let cachedTools: Record<string, (typeof tools)[string]> = tools;
        if (useExplicitCache && toolsEnabled) {
            const names = Object.keys(tools);
            const last = names[names.length - 1];
            const lastTool = last ? tools[last as keyof typeof tools] : undefined;
            if (last && lastTool) {
                cachedTools = {
                    ...tools,
                    [last]: {
                        ...lastTool,
                        providerOptions: {
                            ...(lastTool as { providerOptions?: object })
                                .providerOptions,
                            anthropic: {
                                cacheControl: { type: "ephemeral" as const },
                            },
                        },
                    },
                };
            }
        }

        // Hard-require forced skill tools on early steps until each has run once.
        // Reserve the final step for text so research/search loops cannot burn the
        // entire budget on tools and leave the user with no answer.
        const forceableTools = requiredSkillTools.filter((name) =>
            Object.prototype.hasOwnProperty.call(cachedTools, name),
        );
        const researchHeavy =
            forceableTools.includes("research_skill") ||
            Object.keys(cachedTools).some((name) =>
                /search|scrape|fetch|firecrawl|parallel/i.test(name),
            );
        const maxSteps = Math.min(
            32,
            policy.maxSteps + (researchHeavy ? 4 : 0),
        );

        const streamStartedAt = Date.now();
        let firstTokenAt: number | null = null;

        const result = streamText({
            model: modelInstance,
            abortSignal: request.signal,
            messages: cachedMessages,
            ...(policy.promptCaching
                ? {}
                : { system: promptParts.full }),
            ...(anthropicThinkingOn
                ? { temperature: 1 }
                : {
                      temperature: body.temperature ?? 0.7,
                      topP: body.topP ?? 1,
                  }),
            maxOutputTokens,
            // ChatGPT subscription 429 usage limits are not transient — don't burn
            // three attempts before surfacing the plan/quota error.
            maxRetries:
                body.provider === "chatgpt"
                    ? 0
                    : (body.openAICompatible?.maxRetries ?? undefined),
            tools: Object.keys(cachedTools).length > 0 ? cachedTools : undefined,
            stopWhen: stepCountIs(maxSteps),
            ...(safeProviderOptions ? { providerOptions: safeProviderOptions } : {}),
            prepareStep: ({ steps }) => {
                // Last allowed step: no more tools — synthesize from results.
                if (steps.length >= maxSteps - 1) {
                    return { toolChoice: "none" as const };
                }
                if (!forceableTools.length) return {};
                const called = new Set<string>();
                for (const step of steps) {
                    for (const call of step.toolCalls ?? []) {
                        if (call?.toolName) called.add(call.toolName);
                    }
                }
                const next = forceableTools.find((name) => !called.has(name));
                if (!next) return {};
                return {
                    toolChoice: {
                        type: "tool" as const,
                        toolName: next,
                    },
                };
            },
            onFinish: async () => {
                await closeLoadedMcp();
            },
            onAbort: async () => {
                await closeLoadedMcp();
            },
        });

        return withCors(
            request,
            result.toUIMessageStreamResponse({
                sendReasoning: true,
                onError: (error) => publicChatError(error, body.provider),
                // Attach real provider-reported usage plus the model/provider
                // used for this request to the assistant message metadata so
                // the client can persist and aggregate it (usage analytics).
                messageMetadata: ({ part }) => {
                    if (
                        (part.type === "text-delta" ||
                            part.type === "reasoning-delta" ||
                            part.type === "tool-input-start") &&
                        firstTokenAt == null
                    ) {
                        firstTokenAt = Date.now();
                    }
                    if (part.type !== "finish") return undefined;
                    const finishedAt = Date.now();
                    const ttftMs =
                        firstTokenAt != null
                            ? Math.max(0, firstTokenAt - streamStartedAt)
                            : Math.max(0, finishedAt - streamStartedAt);
                    return {
                        usage: part.totalUsage,
                        model: body.model,
                        provider: body.provider,
                        timing: {
                            ttftMs,
                            durationMs: Math.max(0, finishedAt - streamStartedAt),
                        },
                    };
                },
            }),
        );
    } catch (err) {
        await closeLoadedMcp();
        const errorMsg = publicChatError(err, body.provider);
        const kind = classifyProviderError(err, {
            provider: body.provider,
            context: "chat",
        }).kind;
        console.error("[api/chat]", errorMsg.split("\n")[0]);
        return withCors(
            request,
            Response.json(
                { error: errorMsg },
                { status: httpStatusForProviderError(kind) },
            ),
        );
    }
}
