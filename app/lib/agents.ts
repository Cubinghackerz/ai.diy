/**
 * Agents & prompt templates — merged view over built-in and user-created
 * entries, plus `{{variable}}` substitution for prompt templates.
 *
 * Built-ins are immutable constants; custom entries live in settings
 * (localStorage, encrypted when the vault is enabled) and always take
 * precedence in ordering so the user's own material is easy to find.
 */

import {
    PREBUILT_AGENTS,
    PREBUILT_PROMPTS,
    type Agent,
    type AppSettings,
    type PromptTemplate,
} from "~/lib/types";

/** Built-in + custom prompt templates, custom first. */
export function allPrompts(settings: AppSettings): PromptTemplate[] {
    return [...settings.customPrompts, ...PREBUILT_PROMPTS];
}

/** Built-in + custom agents, custom first. */
export function allAgents(settings: AppSettings): Agent[] {
    return [...settings.customAgents, ...PREBUILT_AGENTS];
}

/** The currently active agent, if any. */
export function findActiveAgent(settings: AppSettings): Agent | null {
    if (!settings.chat.activeAgentId) return null;
    return (
        allAgents(settings).find(
            (agent) => agent.id === settings.chat.activeAgentId,
        ) ?? null
    );
}

/** A prompt template is user-created when it is not a built-in id. */
export function isBuiltinPrompt(prompt: PromptTemplate): boolean {
    return PREBUILT_PROMPTS.some((builtin) => builtin.id === prompt.id);
}

export function isBuiltinAgent(agent: Agent): boolean {
    return PREBUILT_AGENTS.some((builtin) => builtin.id === agent.id);
}

/**
 * Fill `{{name}}` placeholders in a template. Values come from the composer
 * text the user typed after the slash command; unknown placeholders stay in
 * place so the user can fill them before sending.
 */
export function renderPromptTemplate(
    template: string,
    values: Record<string, string> = {},
): string {
    return String(template ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name: string) => {
        const value = values[name]?.trim();
        return value ? value : match;
    });
}
