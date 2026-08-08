/**
 * Token usage modes — control system prompt size, tool suite, step budget,
 * and optional prompt-caching layout for lower $/request.
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
        "Shortest prompt and core tools only. Best for everyday Q&A and light coding.",
    balanced:
        "Lean prompt with search, Python, files, and MCP. Omits heavy skill-suite tools.",
    caching:
        "Balanced capability with a stable cacheable prompt prefix. Cuts repeat input cost on Anthropic/OpenAI-style caches without dropping core tools.",
    full: "Maximum tool catalog, skill suite, and highest step budget.",
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
                maxSteps: 6,
                memoryChars: 1_500,
                skillChars: 4_000,
                maxActiveSkills: 1,
                researchSkill: false,
                instantAnswer: false,
                skillSuite: false,
                generateFile: false,
                connectorsMeta: false,
                compactToolDescriptions: true,
                promptCaching: false,
            };
        case "caching":
            return {
                mode,
                maxSteps: 12,
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
                promptCaching: true,
            };
        case "full":
            return {
                mode: "full",
                maxSteps: 20,
                memoryChars: 4_000,
                skillChars: 16_000,
                maxActiveSkills: 8,
                researchSkill: true,
                instantAnswer: true,
                skillSuite: true,
                generateFile: true,
                connectorsMeta: true,
                compactToolDescriptions: false,
                promptCaching: false,
            };
        case "balanced":
        default:
            return {
                mode: "balanced",
                maxSteps: 12,
                memoryChars: 2_500,
                skillChars: 8_000,
                maxActiveSkills: 2,
                researchSkill: false,
                instantAnswer: true,
                skillSuite: false,
                generateFile: true,
                connectorsMeta: true,
                compactToolDescriptions: true,
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
