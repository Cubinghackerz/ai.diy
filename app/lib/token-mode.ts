/**
 * Token usage modes — control system prompt size, tool suite, step budget,
 * search/result caps, and optional prompt-caching layout for lower $/request.
 *
 * Design goal: cut waste (padding, oversized search dumps, redundant tools)
 * without cutting answer quality. Prefer fewer high-signal tool results over
 * flooding the context with low-value snippets.
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
        "Lean prompt and core tools (12 steps). Best for everyday Q&A and light coding without bloating context.",
    balanced:
        "Full everyday tools with a compact prompt (16 steps). Search stays high-signal: fewer hits, tighter snippets, fetch only for proof.",
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
                maxSteps: 12,
                memoryChars: 1_200,
                skillChars: 3_500,
                maxActiveSkills: 1,
                researchSkill: false,
                instantAnswer: false,
                skillSuite: false,
                generateFile: false,
                connectorsMeta: false,
                compactToolDescriptions: true,
                // Quality: enough ranked hits to pick a source, not a dump.
                defaultSearchResults: 8,
                maxSearchResults: 12,
                maxSnippetChars: 140,
                maxFetchChars: 3_500,
                maxMcpResultChars: 8_000,
                promptCaching: false,
            };
        case "caching":
            return {
                mode,
                maxSteps: 16,
                memoryChars: 2_000,
                skillChars: 6_000,
                maxActiveSkills: 2,
                researchSkill: false,
                instantAnswer: true,
                skillSuite: false,
                generateFile: true,
                connectorsMeta: true,
                compactToolDescriptions: true,
                defaultSearchResults: 8,
                maxSearchResults: 12,
                maxSnippetChars: 160,
                maxFetchChars: 4_500,
                maxMcpResultChars: 10_000,
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
                defaultSearchResults: 16,
                maxSearchResults: 24,
                maxSnippetChars: 240,
                maxFetchChars: 10_000,
                maxMcpResultChars: 24_000,
                promptCaching: false,
            };
        case "balanced":
        default:
            return {
                mode: "balanced",
                maxSteps: 16,
                memoryChars: 2_000,
                skillChars: 6_000,
                maxActiveSkills: 2,
                researchSkill: false,
                instantAnswer: true,
                skillSuite: false,
                generateFile: true,
                connectorsMeta: true,
                compactToolDescriptions: true,
                // High-signal default: model can raise maxResults when needed.
                defaultSearchResults: 8,
                maxSearchResults: 14,
                maxSnippetChars: 160,
                maxFetchChars: 4_500,
                maxMcpResultChars: 10_000,
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
