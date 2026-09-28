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

/** One-line blurbs for compact UI (message hover menu). */
export const TOKEN_MODE_BLURBS: Record<TokenMode, string> = {
    efficient: "12 steps · lean prompt & core tools",
    balanced: "16 steps · everyday tools, compact prompt",
    caching: "16 steps · stable cacheable prefix",
    full: "24 steps · max tools, skills & budget",
};

export const TOKEN_MODE_DESCRIPTIONS: Record<TokenMode, string> = {
    efficient:
        "Lean prompt and core tools (12 steps). Search stays short: fewer hits, tighter snippets, one page fetch.",
    balanced:
        "Full everyday tools with a compact prompt (16 steps). Search stays high-signal: fewer hits, tighter snippets, fetch only for proof.",
    caching:
        "Balanced capability with a stable cacheable prompt prefix (16 steps). Search budget matches Balanced. Cuts repeat input cost on Anthropic/OpenAI-style caches.",
    full: "Maximum tool catalog, skill suite, and highest step budget (24 steps). Longer search queries, more hits, and longer page fetches.",
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
    /** In-browser Linux VM tools (`linux_run_command` / `linux_read_file`). */
    linuxEnvironment: boolean;
    compactToolDescriptions: boolean;
    /** Default / injected search hit count when the model omits a limit. */
    defaultSearchResults: number;
    /** Hard ceiling on search hits (built-in + MCP arg clamping). */
    maxSearchResults: number;
    /** Max characters kept in a search query after focusing. */
    maxQueryChars: number;
    /** Max words the model should put in one search query. */
    maxQueryWords: number;
    /** Max chars per search-result snippet / excerpt. */
    maxSnippetChars: number;
    /** Max chars returned from fetch_url / read_url. */
    maxFetchChars: number;
    /** How many pages to fetch after a search before answering. */
    maxFetches: number;
    /** Max chars for any single MCP tool result after compacting. */
    maxMcpResultChars: number;
    /** Number of newest UI messages kept verbatim before old tool outputs are projected. */
    historyKeepRecent: number;
    /** Project bulky tool results from older turns before sending model history. */
    compactHistoricalToolResults: boolean;
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
                linuxEnvironment: true,
                compactToolDescriptions: true,
                // Quality: enough ranked hits to pick a source, not a dump.
                defaultSearchResults: 4,
                maxSearchResults: 6,
                maxQueryChars: 80,
                maxQueryWords: 6,
                maxSnippetChars: 100,
                maxFetchChars: 2_000,
                maxFetches: 1,
                maxMcpResultChars: 8_000,
                historyKeepRecent: 6,
                compactHistoricalToolResults: true,
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
                linuxEnvironment: true,
                compactToolDescriptions: true,
                defaultSearchResults: 6,
                maxSearchResults: 10,
                maxQueryChars: 120,
                maxQueryWords: 10,
                maxSnippetChars: 160,
                maxFetchChars: 4_000,
                maxFetches: 2,
                maxMcpResultChars: 10_000,
                historyKeepRecent: 8,
                compactHistoricalToolResults: true,
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
                linuxEnvironment: true,
                compactToolDescriptions: false,
                defaultSearchResults: 12,
                maxSearchResults: 20,
                maxQueryChars: 200,
                maxQueryWords: 16,
                maxSnippetChars: 280,
                maxFetchChars: 12_000,
                maxFetches: 4,
                maxMcpResultChars: 24_000,
                historyKeepRecent: 10,
                compactHistoricalToolResults: false,
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
                linuxEnvironment: true,
                compactToolDescriptions: true,
                // High-signal default: model can raise maxResults when needed.
                defaultSearchResults: 6,
                maxSearchResults: 10,
                maxQueryChars: 120,
                maxQueryWords: 10,
                maxSnippetChars: 160,
                maxFetchChars: 4_000,
                maxFetches: 2,
                maxMcpResultChars: 10_000,
                historyKeepRecent: 8,
                compactHistoricalToolResults: true,
                promptCaching: false,
            };
    }
}

/** Mode-specific search limits the model must follow. Stable for a given mode. */
export function searchBudgetInstruction(policy: TokenModePolicy): string {
    return `

Search budget (${policy.mode}):
- One query is at most ${policy.maxQueryWords} words and ${policy.maxQueryChars} characters. Do not paste the user prompt into the query.
- Ask for ${policy.defaultSearchResults} results by default. Never request more than ${policy.maxSearchResults}.
- Snippets are capped near ${policy.maxSnippetChars} characters. They are leads, not proof.
- Fetch at most ${policy.maxFetches} page${policy.maxFetches === 1 ? "" : "s"} after search. Each fetch is truncated near ${policy.maxFetchChars} characters.
- Stop after one successful search unless the hits are empty or off-topic.`;
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
