import {
    estimateMessagesTokens,
    estimateTokensFromText,
    type CompactableMessage,
} from "~/lib/server/context-compaction";

export type PromptBudgetBreakdown = {
    systemTokens: number;
    historyTokens: number;
    builtInToolTokens: number;
    mcpToolTokens: number;
    totalTokens: number;
    historyMessages: number;
    builtInTools: number;
    mcpTools: number;
};

function safeToolText(name: string, tool: unknown): string {
    if (!tool || typeof tool !== "object") return name;
    const value = tool as Record<string, unknown>;
    const description = typeof value.description === "string" ? value.description : "";
    const schema = value.inputSchema;
    let schemaText = "";
    try {
        schemaText = JSON.stringify(schema, (_key, item) =>
            typeof item === "function" ? undefined : item,
        ) || "";
    } catch {
        schemaText = "schema";
    }
    return `${name}\n${description}\n${schemaText}`;
}

export function estimateToolSetTokens(
    tools: Record<string, unknown> | undefined,
): number {
    if (!tools) return 0;
    return estimateTokensFromText(
        Object.entries(tools)
            .map(([name, tool]) => safeToolText(name, tool))
            .join("\n"),
    );
}

export function estimatePromptBudget(input: {
    systemText: string;
    messages: CompactableMessage[];
    builtInTools?: Record<string, unknown>;
    mcpTools?: Record<string, unknown>;
}): PromptBudgetBreakdown {
    const builtInToolTokens = estimateToolSetTokens(input.builtInTools);
    const mcpToolTokens = estimateToolSetTokens(input.mcpTools);
    const historyTokens = estimateMessagesTokens(input.messages);
    const systemTokens = estimateTokensFromText(input.systemText);
    return {
        systemTokens,
        historyTokens,
        builtInToolTokens,
        mcpToolTokens,
        totalTokens: systemTokens + historyTokens + builtInToolTokens + mcpToolTokens,
        historyMessages: input.messages.length,
        builtInTools: Object.keys(input.builtInTools ?? {}).length,
        mcpTools: Object.keys(input.mcpTools ?? {}).length,
    };
}
