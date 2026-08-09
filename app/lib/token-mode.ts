/**
 * Token usage modes — control system prompt size, tool suite, step budget,
 * search/result caps, and optional prompt-caching layout for lower $/request.
 */

export type TokenMode = "efficient" | "balanced" | "caching" | "full";

export const TOKEN_MODE_LABELS: Record<TokenMode, string> = {
    efficient: "Token efficiency",
    balanced: "Balanced",
    caching: "Prompt caching",
    full: "Full suite",
};

export const TOKEN_MODE_DESCRIPTIONS: Record<TokenMode, string> = {
    efficient:
        "Shortest prompt and core tools only (12 steps). Best for everyday Q&A and light coding.",
    balanced:
        "Full everyday tools with a lean prompt (16 steps). Web search hits and snippets stay short so Parallel/Firecrawl do not flood context.",
    caching:
        "Balanced capability with a stable cacheable prompt prefix (16 steps). Cuts repeat input cost on Anthropic/OpenAI-style caches without dropping core tools.",
    full: "Maximum tool catalog, skill suite, and highest step budget (24 steps).",
};

export function normalizeTokenMode(value: unknown): TokenMode {
    if (
        value === "efficient" ||
        value === "balanced" ||
        value === "caching" ||
        value === "full"
    ) {
        return value;
    }
    return "balanced";
}

export interface TokenModePolicy {
    mode: TokenMode;
    maxSteps: number;
    memoryChars: number;
    skillChars: number;
    maxActiveSkills: number;
    researchSkill: boolean;
    instantAnswer: boolean;
    skillSuite: boolean;
    generateFile: boolean;
    connectorsMeta: boolean;
    compactToolDescriptions: boolean;
    /** Default / injected search hit count when the model omits a limit. */
    defaultSearchResults: number;
    /** Hard ceiling on search hits (built-in + MCP arg clamping). */
    maxSearchResults: number;
    /** Max chars per search-result snippet / excerpt. */
    maxSnippetChars: number;
    /** Max chars returned from fetch_url / read_url. */
    maxFetchChars: number;
    /** Max chars for any single MCP tool result after compacting. */
    maxMcpResultChars: number;
    /**
     * Split system prompt into a large stable prefix (cacheable) and a small
     * volatile suffix (date, memory, skills). Enables provider cache breakpoints.
     */
    promptCaching: boolean;
}

export function tokenModePolicy(mode: TokenMode): TokenModePolicy {
    switch (mode) {
        case "efficient":
            return {
                mode,
                // Research/search loops need room for tools *plus* a final answer step.
                maxSteps: 12,
                memoryChars: 1_500,
                skillChars: 4_000,
                maxActiveSkills: 1,
                researchSkill: false,
                instantAnswer: false,
                skillSuite: false,
                generateFile: false,
                connectorsMeta: false,
                compactToolDescriptions: true,
                defaultSearchResults: 6,
                maxSearchResults: 6,
                maxSnippetChars: 80,
                maxFetchChars: 2_000,
                maxMcpResultChars: 2_500,
                promptCaching: false,
            };
        case "caching":
            return {
                mode,
                maxSteps: 16,
                memoryChars: 2_500,
                skillChars: 8_000,
                maxActiveSkills: 2,
                researchSkill: false,
                instantAnswer: true,
                skillSuite: false,
                generateFile: true,
                connectorsMeta: true,
                // Keep tool schemas identical across turns for cache hits.
                compactToolDescriptions: true,
                // Prefer ranked hits with tight snippets over long page dumps.
                defaultSearchResults: 9,
                maxSearchResults: 9,
                maxSnippetChars: 100,
                maxFetchChars: 4_000,
                maxMcpResultChars: 8_000,
                promptCaching: true,
            };
        case "full":
            return {
                mode: "full",
                maxSteps: 24,
                memoryChars: 4_000,
                skillChars: 16_000,
                maxActiveSkills: 8,
                researchSkill: true,
                instantAnswer: true,
                skillSuite: true,
                generateFile: true,
                connectorsMeta: true,
                compactToolDescriptions: false,
                defaultSearchResults: 9,
                maxSearchResults: 15,
                maxSnippetChars: 160,
                maxFetchChars: 8_000,
                maxMcpResultChars: 16_000,
                promptCaching: false,
            };
        case "balanced":
        default:
            return {
                mode: "balanced",
                maxSteps: 16,
                memoryChars: 2_500,
                skillChars: 8_000,
                maxActiveSkills: 2,
                researchSkill: false,
                instantAnswer: true,
                skillSuite: false,
                generateFile: true,
                connectorsMeta: true,
                compactToolDescriptions: true,
                // Prefer ranked hits with tight snippets over long page dumps.
                defaultSearchResults: 9,
                maxSearchResults: 9,
                maxSnippetChars: 100,
                maxFetchChars: 4_000,
                maxMcpResultChars: 8_000,
                promptCaching: false,
            };
    }
}

/** Providers where explicit Anthropic-style cache_control is useful. */
export function providerSupportsExplicitCache(
    provider: string | undefined,
): boolean {
    return (
        provider === "anthropic" ||
        provider === "bedrock" ||
        provider === "openrouter" ||
        provider === "gateway"
    );
}
