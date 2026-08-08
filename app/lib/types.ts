/**
 * ai.diy — Shared Type Definitions
 * 
 * 100% Privacy-First, Local-Only TypingMind Clone Types
 */

// ─── Provider Types ───────────────────────────────────────────────

export type ProviderId =
    | "openai"
    | "anthropic"
    | "gemini"
    | "groq"
    | "openrouter"
    | "deepseek"
    | "bedrock"
    | "azure"
    | "vertex"
    | "gateway"
    | "togetherai"
    | "mistral"
    | "huggingface"
    | "lmstudio"
    | "xai"
    | "ollama"
    | "custom";

export type ConnectorKind =
    | "tavily"
    | "brave"
    | "exa"
    | "parallel"
    | "github"
    | "supabase"
    | "postgres"
    | "s3"
    | "remote-mcp";

export interface ConnectorConfig {
    id: string;
    kind: ConnectorKind;
    name: string;
    enabled: boolean;
    apiKey?: string;
    endpoint?: string;
    projectUrl?: string;
    bucket?: string;
    region?: string;
}

export interface ProviderConfig {
    id: ProviderId;
    name: string;
    apiKey: string;
    baseUrl?: string;
    enabled: boolean;
    openAICompatible?: {
        apiMode: "auto" | "chat" | "responses";
        reasoningWithTools: "auto" | "none" | "allow";
        authMode?: "bearer" | "api-key-header" | "custom-header" | "none";
        authHeader?: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
        maxRetries?: number;
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

export interface ModelInfo {
    id: string;
    name: string;
    provider: ProviderId;
    contextWindow?: number;
    maxTokens?: number;
    supportsTools?: boolean;
    supportsVision?: boolean;
    supportsStreaming?: boolean;
    supportsReasoning?: boolean;
    supportsStructuredOutputs?: boolean;
    supportsAudio?: boolean;
    supportsImageGeneration?: boolean;
    supportsVideo?: boolean;
}

/** Reasoning / thinking effort when the selected model supports it. */
export type ReasoningEffort = "off" | "minimal" | "low" | "medium" | "high";

export interface ChatSettings {
    systemPrompt: string;
    temperature: number;
    maxTokens: number | null;
    topP: number;
    model: string;
    provider: ProviderId;
    /** Used only when the current model supports reasoning / thinking. */
    reasoningEffort: ReasoningEffort;
    imageSize: "1024x1024" | "1536x1024" | "1024x1536";
    imageCount: number;
    activeAgentId?: string | null;
}

/** A model selection used by the opt-in multi-model preview workspace. */
export interface PreviewModelConfig {
    provider: ProviderId;
    model: string;
    reasoningEffort: ReasoningEffort;
}

export interface PreviewSettings {
    enabled: boolean;
    /** One to three independent models run in parallel. */
    primaryModels: PreviewModelConfig[];
    /** Optional fourth model that synthesizes completed primary outputs. */
    fusionModel: PreviewModelConfig | null;
}

// ─── Settings Types ──────────────────────────────────────────────

export interface AppSettings {
    providers: Record<ProviderId, ProviderConfig>;
    chat: ChatSettings;
    theme: "light" | "dark" | "system";
    /** Set true after the user finishes first-run key / model setup. */
    setupComplete: boolean;
    encryptionEnabled: boolean;
    encryptionPassphrase: string | null;
    // Tool settings
    webSearchEnabled: boolean;
    webSearchEngine: "duckduckgo" | "searxng";
    searxngUrl: string;
    pythonEnabled: boolean;
    calculatorEnabled: boolean;
    memoryEnabled: boolean;
    skillsEnabled: boolean;
    /** Beta: let the model delegate subtasks to user-approved subagents. */
    subagentsEnabled: boolean;
    /**
     * Agent Mode: plan → select installed skills/tools → execute → verify.
     * Uses General Task Solver routing when available.
     */
    agentModeEnabled: boolean;
    preview: PreviewSettings;
    // MCP settings
    mcpServers: McpServerConfig[];
    connectors: ConnectorConfig[];
    customSkills: CustomSkill[];
    cloudStorage: import("./cloud-storage/types").CloudStorageConfig;
}

export interface McpServerConfig {
    id: string;
    name: string;
    kind: "sse" | "stdio" | "http";
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    /** Additional request headers for authenticated HTTP/SSE MCP servers. */
    headers?: Record<string, string>;
    enabled: boolean;
}

/**
 * Free hosted web-search MCP servers bundled with the app. No API key is
 * required; the model is prompted to prefer these over the DuckDuckGo
 * fallback whenever they are enabled.
 */
export const FREE_SEARCH_MCP_PRESETS: McpServerConfig[] = [
    {
        id: "mcp_parallel_search",
        name: "Parallel Search MCP",
        kind: "http",
        url: "https://search.parallel.ai/mcp",
        enabled: true,
    },
    {
        id: "mcp_firecrawl_keyless",
        name: "Firecrawl (Keyless)",
        kind: "http",
        url: "https://mcp.firecrawl.dev/v2/mcp",
        enabled: true,
    },
];

// ─── Agent & Prompt Types ────────────────────────────────────────

export interface Agent {
    id: string;
    name: string;
    description: string;
    avatar: string;
    systemPrompt: string;
    defaultProvider?: ProviderId;
    defaultModel?: string;
}

export interface PromptTemplate {
    id: string;
    title: string;
    content: string;
    category: string;
}

export interface KnowledgeDocument {
    id: string;
    name: string;
    content: string;
    size: number;
    createdAt: number;
}

export interface MemoryEntry {
    id: string;
    content: string;
    source: "chat" | "import" | "manual";
    sourceId?: string;
    keywords: string[];
    createdAt: number;
    updatedAt: number;
}

export interface CustomSkill {
    id: string;
    name: string;
    description: string;
    content: string;
    enabled: boolean;
}

// ─── Project Types (ChatGPT-style folders) ───────────────────────

/** Accent colors available for project folders. */
export const PROJECT_COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
] as const;

export interface Project {
    id: string;
    name: string;
    color: string;
    /** Project-level instructions appended to every chat in the project. */
    instructions?: string;
    createdAt: number;
    updatedAt: number;
}

// ─── Thread/Message Types ────────────────────────────────────────

export interface ThreadData {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    systemPrompt?: string;
    model?: string;
    provider?: ProviderId;
    /** Optional ChatGPT-style project folder this thread belongs to. */
    projectId?: string | null;
}

export interface MessageData {
    id: string;
    threadId: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    createdAt: number;
    /** Full AI SDK UIMessage JSON for faithful restore (tools, reasoning, etc.) */
    uiMessage?: Record<string, unknown>;
    toolCalls?: ToolCallData[];
    toolResults?: ToolResultData[];
}

export interface ToolCallData {
    id: string;
    name: string;
    args: Record<string, unknown>;
}

export interface ToolResultData {
    toolCallId: string;
    name: string;
    result: unknown;
    isError?: boolean;
}

// ─── Default Provider Configs ────────────────────────────────────

export const PROVIDER_DEFAULTS: Record<ProviderId, Omit<ProviderConfig, "apiKey" | "enabled">> = {
    openai: {
        id: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
    },
    anthropic: {
        id: "anthropic",
        name: "Anthropic",
        baseUrl: "https://api.anthropic.com",
    },
    gemini: {
        id: "gemini",
        name: "Google Gemini",
        baseUrl: "https://generativelanguage.googleapis.com",
    },
    groq: {
        id: "groq",
        name: "Groq",
        baseUrl: "https://api.groq.com/openai/v1",
    },
    openrouter: {
        id: "openrouter",
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
    },
    deepseek: {
        id: "deepseek",
        name: "DeepSeek",
        baseUrl: "https://api.deepseek.com",
    },
    bedrock: {
        id: "bedrock",
        name: "Amazon Bedrock",
        baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
    },
    azure: {
        id: "azure",
        name: "Azure OpenAI",
        baseUrl: "",
    },
    vertex: {
        id: "vertex",
        name: "Google Vertex AI",
        baseUrl: "https://us-central1-aiplatform.googleapis.com",
    },
    gateway: {
        id: "gateway",
        name: "Vercel AI Gateway",
        baseUrl: "https://ai-gateway.vercel.sh/v4/ai",
    },
    togetherai: {
        id: "togetherai",
        name: "Together AI",
        baseUrl: "https://api.together.xyz/v1",
    },
    mistral: {
        id: "mistral",
        name: "Mistral",
        baseUrl: "https://api.mistral.ai/v1",
    },
    huggingface: {
        id: "huggingface",
        name: "Hugging Face",
        baseUrl: "https://router.huggingface.co/v1",
    },
    lmstudio: {
        id: "lmstudio",
        name: "LM Studio (Local)",
        baseUrl: "http://localhost:1234/v1",
    },
    xai: {
        id: "xai",
        name: "xAI (Grok)",
        baseUrl: "https://api.x.ai/v1",
    },
    ollama: {
        id: "ollama",
        name: "Ollama (Local)",
        baseUrl: "http://localhost:11434/v1",
    },
    custom: {
        id: "custom",
        name: "Custom OpenAI Proxy",
        baseUrl: "http://localhost:1234/v1",
    },
};

export const DEFAULT_SETTINGS: AppSettings = {
    providers: {
        openai: { ...PROVIDER_DEFAULTS.openai, apiKey: "", enabled: false },
        anthropic: { ...PROVIDER_DEFAULTS.anthropic, apiKey: "", enabled: false },
        gemini: { ...PROVIDER_DEFAULTS.gemini, apiKey: "", enabled: false },
        groq: { ...PROVIDER_DEFAULTS.groq, apiKey: "", enabled: false },
        openrouter: { ...PROVIDER_DEFAULTS.openrouter, apiKey: "", enabled: false },
        deepseek: { ...PROVIDER_DEFAULTS.deepseek, apiKey: "", enabled: false },
        bedrock: { ...PROVIDER_DEFAULTS.bedrock, apiKey: "", enabled: false },
        azure: { ...PROVIDER_DEFAULTS.azure, apiKey: "", enabled: false },
        vertex: { ...PROVIDER_DEFAULTS.vertex, apiKey: "", enabled: false },
        gateway: { ...PROVIDER_DEFAULTS.gateway, apiKey: "", enabled: false },
        togetherai: { ...PROVIDER_DEFAULTS.togetherai, apiKey: "", enabled: false },
        mistral: { ...PROVIDER_DEFAULTS.mistral, apiKey: "", enabled: false },
        huggingface: { ...PROVIDER_DEFAULTS.huggingface, apiKey: "", enabled: false },
        lmstudio: { ...PROVIDER_DEFAULTS.lmstudio, apiKey: "lmstudio", enabled: true },
        xai: { ...PROVIDER_DEFAULTS.xai, apiKey: "", enabled: false },
        ollama: { ...PROVIDER_DEFAULTS.ollama, apiKey: "ollama", enabled: true },
        custom: { ...PROVIDER_DEFAULTS.custom, apiKey: "custom", enabled: false },
    },
    chat: {
        systemPrompt: "",
        temperature: 0.7,
        maxTokens: null,
        topP: 1,
        model: "gpt-4o",
        provider: "openai",
        reasoningEffort: "medium",
        imageSize: "1024x1024",
        imageCount: 1,
        activeAgentId: null,
    },
    theme: "system",
    setupComplete: false,
    encryptionEnabled: false,
    encryptionPassphrase: null,
    webSearchEnabled: true,
    webSearchEngine: "duckduckgo",
    searxngUrl: "",
    pythonEnabled: true,
    calculatorEnabled: true,
    memoryEnabled: true,
    skillsEnabled: true,
    subagentsEnabled: false,
    agentModeEnabled: false,
    preview: {
        enabled: false,
        primaryModels: [],
        fusionModel: null,
    },
    mcpServers: FREE_SEARCH_MCP_PRESETS,
    connectors: [],
    customSkills: [],
    cloudStorage: {
        kind: "none",
        autoBackup: false,
        lastBackupAt: null,
    },
};

// ─── Default Models per Provider ─────────────────────────────────

export const DEFAULT_MODELS: Record<ProviderId, ModelInfo[]> = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", contextWindow: 128000, supportsTools: true, supportsVision: true },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", contextWindow: 128000, supportsTools: true, supportsVision: true },
        { id: "gpt-5", name: "GPT-5", provider: "openai", contextWindow: 200000, supportsTools: true, supportsReasoning: true },
        { id: "gpt-5.1", name: "GPT-5.1", provider: "openai", contextWindow: 200000, supportsTools: true, supportsReasoning: true },
        { id: "o3-mini", name: "o3-mini", provider: "openai", contextWindow: 200000, supportsTools: true, supportsReasoning: true },
        { id: "o4-mini", name: "o4-mini", provider: "openai", contextWindow: 200000, supportsTools: true, supportsReasoning: true },
        { id: "gpt-image-1", name: "GPT Image 1", provider: "openai", supportsImageGeneration: true },
        { id: "tts-1", name: "TTS-1", provider: "openai", supportsAudio: true },
        { id: "tts-1-hd", name: "TTS-1 HD", provider: "openai", supportsAudio: true },
        { id: "gpt-4o-mini-tts", name: "GPT-4o Mini TTS", provider: "openai", supportsAudio: true },
    ],
    anthropic: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "anthropic", contextWindow: 200000, supportsTools: true },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "anthropic", contextWindow: 200000, supportsTools: true },
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic", contextWindow: 200000, supportsTools: true, supportsReasoning: true },
        { id: "claude-opus-4-20250514", name: "Claude Opus 4", provider: "anthropic", contextWindow: 200000, supportsTools: true, supportsReasoning: true },
        { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", provider: "anthropic", contextWindow: 200000, supportsTools: true, supportsReasoning: true },
        { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5", provider: "anthropic", contextWindow: 200000, supportsTools: true, supportsReasoning: true },
    ],
    gemini: [
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "gemini", contextWindow: 1048576, supportsTools: true },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "gemini", contextWindow: 1048576, supportsTools: true },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "gemini", contextWindow: 1048576, supportsTools: true, supportsReasoning: true },
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", contextWindow: 1048576, supportsTools: true, supportsReasoning: true },
        { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", provider: "gemini", contextWindow: 1048576, supportsTools: true, supportsReasoning: true },
        { id: "imagen-4.0-generate-001", name: "Imagen 4", provider: "gemini", supportsImageGeneration: true },
        { id: "gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image", provider: "gemini", supportsImageGeneration: true },
        { id: "veo-3.1-generate-preview", name: "Veo 3.1", provider: "gemini", supportsVideo: true },
        { id: "veo-3.0-generate-001", name: "Veo 3.0", provider: "gemini", supportsVideo: true },
        { id: "veo-2.0-generate-001", name: "Veo 2.0", provider: "gemini", supportsVideo: true },
    ],
    groq: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "groq", contextWindow: 131072, supportsTools: true },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", provider: "groq", contextWindow: 32768, supportsTools: true },
    ],
    openrouter: [
        { id: "openai/gpt-4o", name: "GPT-4o (OpenRouter)", provider: "openrouter", supportsTools: true },
        { id: "openai/gpt-5", name: "GPT-5 (OpenRouter)", provider: "openrouter", supportsTools: true, supportsReasoning: true },
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (OpenRouter)", provider: "openrouter", supportsTools: true },
        { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5 (OpenRouter)", provider: "openrouter", supportsTools: true, supportsReasoning: true },
        { id: "deepseek/deepseek-chat", name: "DeepSeek V3 (OpenRouter)", provider: "openrouter", supportsTools: true },
        { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (OpenRouter)", provider: "openrouter", supportsTools: false, supportsReasoning: true },
    ],
    deepseek: [
        { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "deepseek", contextWindow: 1000000, maxTokens: 384000, supportsTools: true, supportsReasoning: true },
        { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "deepseek", contextWindow: 1000000, maxTokens: 384000, supportsTools: true, supportsReasoning: true },
        { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek", contextWindow: 1000000, maxTokens: 384000, supportsTools: true, supportsVision: true },
        { id: "deepseek-reasoner", name: "DeepSeek Reasoner", provider: "deepseek", contextWindow: 1000000, maxTokens: 384000, supportsTools: true, supportsVision: true, supportsReasoning: true },
    ],
    bedrock: [
        { id: "anthropic.claude-sonnet-4-5-20250929-v1:0", name: "Claude Sonnet 4.5", provider: "bedrock", contextWindow: 200000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "anthropic.claude-opus-4-5-20251101-v1:0", name: "Claude Opus 4.5", provider: "bedrock", contextWindow: 200000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "us.amazon.nova-pro-v1:0", name: "Amazon Nova Pro", provider: "bedrock", contextWindow: 300000, supportsTools: true, supportsVision: true },
        { id: "us.amazon.nova-lite-v1:0", name: "Amazon Nova Lite", provider: "bedrock", contextWindow: 300000, supportsTools: true, supportsVision: true },
        { id: "meta.llama3-3-70b-instruct-v1:0", name: "Llama 3.3 70B", provider: "bedrock", contextWindow: 131072, supportsTools: true },
        { id: "amazon.nova-canvas-v1:0", name: "Amazon Nova Canvas", provider: "bedrock", supportsImageGeneration: true },
    ],
    azure: [
        { id: "gpt-5.6", name: "GPT-5.6", provider: "azure", contextWindow: 1050000, maxTokens: 128000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "gpt-5.5", name: "GPT-5.5", provider: "azure", contextWindow: 1050000, maxTokens: 128000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "gpt-4o", name: "GPT-4o", provider: "azure", contextWindow: 128000, supportsTools: true, supportsVision: true },
        { id: "claude-sonnet-5", name: "Claude Sonnet 5", provider: "azure", contextWindow: 1000000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "azure", contextWindow: 1000000, maxTokens: 384000, supportsTools: true, supportsReasoning: true },
    ],
    vertex: [
        { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", provider: "vertex", contextWindow: 1048576, maxTokens: 65536, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "vertex", contextWindow: 1048576, maxTokens: 65536, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "vertex", contextWindow: 1048576, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "claude-sonnet-5@default", name: "Claude Sonnet 5", provider: "vertex", contextWindow: 1000000, maxTokens: 128000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "imagen-4.0-generate-001", name: "Imagen 4", provider: "vertex", supportsImageGeneration: true },
    ],
    gateway: [
        { id: "openai/gpt-5.6", name: "GPT-5.6", provider: "gateway", contextWindow: 1050000, maxTokens: 128000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", provider: "gateway", contextWindow: 1000000, maxTokens: 128000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", provider: "gateway", contextWindow: 1000000, maxTokens: 65536, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "gateway", contextWindow: 1000000, maxTokens: 384000, supportsTools: true, supportsReasoning: true },
        { id: "xai/grok-4.5", name: "Grok 4.5", provider: "gateway", contextWindow: 500000, maxTokens: 500000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "openai/gpt-image-1", name: "GPT Image 1", provider: "gateway", supportsImageGeneration: true },
        { id: "google/veo-3.1-generate-001", name: "Veo 3.1", provider: "gateway", supportsVideo: true },
        { id: "klingai/kling-v2.6-t2v", name: "Kling 2.6", provider: "gateway", supportsVideo: true },
        { id: "bytedance/seedance-v2.0", name: "Seedance 2.0", provider: "gateway", supportsVideo: true },
        { id: "alibaba/wan-v2.7-t2v", name: "Wan 2.7", provider: "gateway", supportsVideo: true },
        { id: "xai/grok-imagine-video-1.5", name: "Grok Imagine Video 1.5", provider: "gateway", supportsVideo: true },
    ],
    togetherai: [
        { id: "moonshotai/Kimi-K3", name: "Kimi K3", provider: "togetherai", contextWindow: 1048576, maxTokens: 131072, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "zai-org/GLM-5.2", name: "GLM 5.2", provider: "togetherai", contextWindow: 262144, maxTokens: 164000, supportsTools: true, supportsReasoning: true },
        { id: "Qwen/Qwen3.7-Max", name: "Qwen 3.7 Max", provider: "togetherai", contextWindow: 1000000, maxTokens: 500000, supportsTools: true },
        { id: "deepseek-ai/DeepSeek-V4-Pro", name: "DeepSeek V4 Pro", provider: "togetherai", contextWindow: 512000, maxTokens: 384000, supportsTools: true, supportsReasoning: true },
        { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Turbo", provider: "togetherai", contextWindow: 131072, supportsTools: true },
        { id: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell", provider: "togetherai", supportsImageGeneration: true },
    ],
    mistral: [
        { id: "mistral-medium-latest", name: "Mistral Medium", provider: "mistral", contextWindow: 262144, maxTokens: 262144, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "mistral-large-latest", name: "Mistral Large", provider: "mistral", contextWindow: 262144, maxTokens: 262144, supportsTools: true },
        { id: "mistral-small-latest", name: "Mistral Small", provider: "mistral", contextWindow: 256000, maxTokens: 256000, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "devstral-latest", name: "Devstral", provider: "mistral", contextWindow: 262144, maxTokens: 262144, supportsTools: true },
        { id: "magistral-medium-latest", name: "Magistral Medium", provider: "mistral", contextWindow: 262144, maxTokens: 262144, supportsTools: true, supportsReasoning: true },
    ],
    huggingface: [
        { id: "moonshotai/Kimi-K3", name: "Kimi K3", provider: "huggingface", contextWindow: 1000000, maxTokens: 131072, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "deepseek-ai/DeepSeek-V4-Pro", name: "DeepSeek V4 Pro", provider: "huggingface", contextWindow: 1048576, maxTokens: 393216, supportsTools: true, supportsReasoning: true },
        { id: "Qwen/Qwen3.6-27B", name: "Qwen 3.6 27B", provider: "huggingface", contextWindow: 262144, maxTokens: 65536, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct", name: "Llama 4 Maverick", provider: "huggingface", contextWindow: 1048576, supportsTools: true, supportsVision: true },
        { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct", name: "Qwen 3 Coder", provider: "huggingface", contextWindow: 262144, supportsTools: true },
    ],
    lmstudio: [
        { id: "openai/gpt-oss-20b", name: "GPT OSS 20B", provider: "lmstudio", contextWindow: 131072, maxTokens: 32768, supportsTools: true, supportsReasoning: true },
        { id: "qwen/qwen3-30b-a3b-2507", name: "Qwen 3 30B", provider: "lmstudio", contextWindow: 262144, maxTokens: 16384, supportsTools: true },
        { id: "qwen/qwen3-coder-30b", name: "Qwen 3 Coder 30B", provider: "lmstudio", contextWindow: 262144, maxTokens: 65536, supportsTools: true },
    ],
    xai: [
        { id: "grok-2", name: "Grok 2", provider: "xai", contextWindow: 131072, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "grok-2-latest", name: "Grok 2 Latest", provider: "xai", contextWindow: 131072, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "grok-3", name: "Grok 3", provider: "xai", contextWindow: 131072, supportsTools: true, supportsReasoning: true },
        { id: "grok-4", name: "Grok 4", provider: "xai", contextWindow: 262144, supportsTools: true, supportsReasoning: true },
        { id: "grok-4-fast", name: "Grok 4 Fast", provider: "xai", contextWindow: 262144, supportsTools: true, supportsReasoning: true },
        { id: "grok-4-fast-mini", name: "Grok 4 Fast Mini", provider: "xai", contextWindow: 262144, supportsTools: true, supportsReasoning: true },
        { id: "grok-2-mini", name: "Grok 2 Mini", provider: "xai", contextWindow: 131072, supportsTools: true, supportsVision: true },
        { id: "grok-1.5", name: "Grok 1.5", provider: "xai", contextWindow: 131072, supportsTools: true, supportsVision: true },
        { id: "grok-2-image-1212", name: "Grok 2 Image", provider: "xai", supportsImageGeneration: true },
    ],
    ollama: [
        { id: "llama3", name: "Llama 3 (Local)", provider: "ollama", supportsTools: true },
        { id: "mistral", name: "Mistral (Local)", provider: "ollama", supportsTools: true },
        { id: "deepseek-r1", name: "DeepSeek R1 (Local)", provider: "ollama", supportsTools: false, supportsReasoning: true },
        { id: "qwen2.5-coder", name: "Qwen 2.5 Coder (Local)", provider: "ollama", supportsTools: true },
        { id: "qwq-32b", name: "QwQ 32B (Local)", provider: "ollama", supportsTools: false, supportsReasoning: true },
    ],
    custom: [
        { id: "default-model", name: "Custom Endpoint Model", provider: "custom", supportsTools: true },
    ],
};

// ─── Prebuilt Agents ─────────────────────────────────────────────

export const PREBUILT_AGENTS: Agent[] = [
    {
        id: "fullstack-dev",
        name: "Senior Full-Stack Engineer",
        description: "Expert in TypeScript, React, Node, Next.js, Python, and system architecture",
        avatar: "⚡",
        systemPrompt: "You are an elite Senior Full-Stack Software Engineer. Write clean, production-grade, self-documenting code with modern best practices, TypeScript strictness, and optimal performance.",
    },
    {
        id: "deep-researcher",
        name: "Deep Web Researcher",
        description: "Specialized in thorough research, fact checking, and synthesis using live web tools",
        avatar: "🔍",
        systemPrompt: "You are a meticulous Senior Research Analyst. Always use web search and page fetch tools to ground your research in verifiable real-time facts. Synthesize information cleanly with citations.",
    },
    {
        id: "data-scientist",
        name: "Data Analyst & Python Dev",
        description: "Performs mathematical analysis, runs Python code, and creates data visual artifacts",
        avatar: "📊",
        systemPrompt: "You are an expert Data Scientist and Python Engineer. Use the run_python tool to execute Python code for math, data transformations, and analysis. Output interactive HTML or clean code artifacts.",
    },
    {
        id: "creative-writer",
        name: "Copywriter & Content Strategist",
        description: "Crafts engaging articles, docs, marketing copy, and clear communication",
        avatar: "✍️",
        systemPrompt: "You are a master copywriter and technical communicator. Craft clear, persuasive, and beautifully formatted content tailored to the audience.",
    },
];

// ─── Prebuilt Prompt Templates ───────────────────────────────────

export const PREBUILT_PROMPTS: PromptTemplate[] = [
    {
        id: "explain-code",
        title: "Explain Complex Code",
        category: "Coding",
        content: "Please explain the following code step by step, highlighting key algorithms and potential edge cases:\n\n```\n{{code}}\n```",
    },
    {
        id: "refactor-clean",
        title: "Refactor for Clean Code",
        category: "Coding",
        content: "Refactor the following code to make it more readable, efficient, and follow TypeScript best practices:\n\n```\n{{code}}\n```",
    },
    {
        id: "summarize-url",
        title: "Summarize Web Page",
        category: "Research",
        content: "Fetch the content from {{url}} and provide a 5-bullet executive summary with key takeaways.",
    },
];
