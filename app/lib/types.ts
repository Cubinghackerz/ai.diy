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
    | "xai"
    | "ollama"
    | "custom";

export interface ProviderConfig {
    id: ProviderId;
    name: string;
    apiKey: string;
    baseUrl?: string;
    enabled: boolean;
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
}

/** Reasoning / thinking effort when the selected model supports it. */
export type ReasoningEffort = "off" | "low" | "medium" | "high";

export interface ChatSettings {
    systemPrompt: string;
    temperature: number;
    maxTokens: number | null;
    topP: number;
    model: string;
    provider: ProviderId;
    /** Used only when the current model supports reasoning / thinking. */
    reasoningEffort: ReasoningEffort;
    activeAgentId?: string | null;
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
    // MCP settings
    mcpServers: McpServerConfig[];
}

export interface McpServerConfig {
    id: string;
    name: string;
    kind: "sse" | "stdio" | "http";
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    enabled: boolean;
}

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

// ─── Thread/Message Types ────────────────────────────────────────

export interface ThreadData {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    systemPrompt?: string;
    model?: string;
    provider?: ProviderId;
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
    mcpServers: [],
};

// ─── Default Models per Provider ─────────────────────────────────

export const DEFAULT_MODELS: Record<ProviderId, ModelInfo[]> = {
    openai: [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", contextWindow: 128000, supportsTools: true, supportsVision: true },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", contextWindow: 128000, supportsTools: true, supportsVision: true },
        { id: "o3-mini", name: "o3-mini", provider: "openai", contextWindow: 200000, supportsTools: true },
        { id: "o4-mini", name: "o4-mini", provider: "openai", contextWindow: 200000, supportsTools: true },
        { id: "gpt-5", name: "GPT-5", provider: "openai", contextWindow: 200000, supportsTools: true },
    ],
    anthropic: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "anthropic", contextWindow: 200000, supportsTools: true },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", provider: "anthropic", contextWindow: 200000, supportsTools: true },
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic", contextWindow: 200000, supportsTools: true },
        { id: "claude-opus-4-20250514", name: "Claude Opus 4", provider: "anthropic", contextWindow: 200000, supportsTools: true },
    ],
    gemini: [
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "gemini", contextWindow: 1048576, supportsTools: true },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "gemini", contextWindow: 1048576, supportsTools: true },
        { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "gemini", contextWindow: 1048576, supportsTools: true },
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini", contextWindow: 1048576, supportsTools: true },
    ],
    groq: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "groq", contextWindow: 131072, supportsTools: true },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", provider: "groq", contextWindow: 32768, supportsTools: true },
    ],
    openrouter: [
        { id: "openai/gpt-4o", name: "GPT-4o (OpenRouter)", provider: "openrouter", supportsTools: true },
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (OpenRouter)", provider: "openrouter", supportsTools: true },
        { id: "deepseek/deepseek-chat", name: "DeepSeek V3 (OpenRouter)", provider: "openrouter", supportsTools: true },
    ],
    xai: [
        { id: "grok-2", name: "Grok 2", provider: "xai", contextWindow: 131072, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "grok-2-latest", name: "Grok 2 Latest", provider: "xai", contextWindow: 131072, supportsTools: true, supportsVision: true, supportsReasoning: true },
        { id: "grok-2-mini", name: "Grok 2 Mini", provider: "xai", contextWindow: 131072, supportsTools: true, supportsVision: true },
        { id: "grok-1.5", name: "Grok 1.5", provider: "xai", contextWindow: 131072, supportsTools: true, supportsVision: true },
    ],
    ollama: [
        { id: "llama3", name: "Llama 3 (Local)", provider: "ollama", supportsTools: true },
        { id: "mistral", name: "Mistral (Local)", provider: "ollama", supportsTools: true },
        { id: "deepseek-r1", name: "DeepSeek R1 (Local)", provider: "ollama", supportsTools: false },
        { id: "qwen2.5-coder", name: "Qwen 2.5 Coder (Local)", provider: "ollama", supportsTools: true },
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
