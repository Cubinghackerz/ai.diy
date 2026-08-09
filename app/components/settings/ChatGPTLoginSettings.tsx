/**
 * Login with ChatGPT — Experimental BETA control for Settings.
 */

import { LoginWithChatGPT, useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import { useCallback, useEffect, useRef } from "react";
import { pickLatestChatGPTModel } from "~/lib/chatgpt-models";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { DEFAULT_MODELS } from "~/lib/types";

async function fetchChatGPTModelIds(): Promise<{ ids: string[]; latest: string }> {
    const fallback = DEFAULT_MODELS.chatgpt?.[0]?.id ?? "gpt-5.6";
    try {
        const res = await fetch("/api/models", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "chatgpt" }),
        });
        const data = (await res.json()) as {
            models?: Array<{ id?: string }>;
        };
        const ids = (data.models ?? [])
            .map((m) => m.id)
            .filter((id): id is string => typeof id === "string" && id.length > 0);
        return {
            ids,
            latest: pickLatestChatGPTModel(ids) ?? fallback,
        };
    } catch {
        return { ids: [], latest: fallback };
    }
}

export function ChatGPTLoginSettings() {
    const { settings, updateSettings, updateProvider, updateChat } = useSettings();
    const enabled = settings.chatgptLoginEnabled === true;
    const { status, isAuthenticated, user, logout } = useLoginWithChatGPT();
    const wasAuth = useRef(false);
    const syncedModels = useRef(false);

    const selectLatestOnConnect = useCallback(async () => {
        const { latest } = await fetchChatGPTModelIds();
        updateProvider("chatgpt", { enabled: true });
        updateChat({ provider: "chatgpt", model: latest });
        syncedModels.current = true;
    }, [updateChat, updateProvider]);

    /** Keep ChatGPT enabled; only change model if missing from account list. */
    const syncDiscoveredModels = useCallback(async () => {
        updateProvider("chatgpt", { enabled: true });
        const { ids, latest } = await fetchChatGPTModelIds();
        syncedModels.current = true;
        if (settings.chat.provider !== "chatgpt") {
            updateChat({ provider: "chatgpt", model: latest });
            return;
        }
        if (ids.length > 0 && !ids.includes(settings.chat.model)) {
            updateChat({ provider: "chatgpt", model: latest });
        }
    }, [
        settings.chat.model,
        settings.chat.provider,
        updateChat,
        updateProvider,
    ]);

    useEffect(() => {
        if (!enabled) return;
        if (isAuthenticated) {
            wasAuth.current = true;
            if (!syncedModels.current) {
                void syncDiscoveredModels();
            }
            return;
        }
        syncedModels.current = false;
        if (
            wasAuth.current &&
            (status === "unauthenticated" || status === "expired")
        ) {
            wasAuth.current = false;
            updateProvider("chatgpt", { enabled: false });
            if (settings.chat.provider === "chatgpt") {
                updateChat({ provider: "openai", model: "gpt-4o" });
            }
        }
    }, [
        enabled,
        isAuthenticated,
        status,
        settings.chat.provider,
        syncDiscoveredModels,
        updateChat,
        updateProvider,
    ]);

    const planLabel = user?.plan?.trim() || null;
    const isFreePlan = /free/i.test(planLabel ?? "");

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
                <div className="min-w-0">
                    <p className="text-xs font-medium">
                        Login with ChatGPT{" "}
                        <span className="text-[9px] uppercase tracking-wider text-primary">
                            Beta
                        </span>
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Uses your ChatGPT plan through this server (HttpOnly session).
                        Prompts and attachments pass through ai.diy. Not an official OpenAI
                        product and not an API key. Disconnect anytime.
                    </p>
                </div>
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
                    <span className="sr-only">Enable ChatGPT login</span>
                    <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={enabled}
                        onChange={(e) => {
                            const next = e.target.checked;
                            updateSettings({ chatgptLoginEnabled: next });
                            if (!next) {
                                syncedModels.current = false;
                                void logout();
                                updateProvider("chatgpt", { enabled: false });
                                if (settings.chat.provider === "chatgpt") {
                                    updateChat({ provider: "openai", model: "gpt-4o" });
                                }
                            }
                        }}
                    />
                </label>
            </div>

            {enabled ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <LoginWithChatGPT
                        consent={{
                            appName: "ai.diy",
                            continueLabel: "I understand — continue",
                        }}
                        onAuthenticated={() => {
                            void selectLatestOnConnect();
                        }}
                    />
                    {isAuthenticated && user?.email ? (
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                            Connected as {user.email}
                            {planLabel ? ` · ${planLabel}` : ""}
                        </p>
                    ) : null}
                    {isAuthenticated && isFreePlan ? (
                        <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                            Free Plan has a low Codex usage quota. If chats fail with a usage
                            limit, wait for reset, upgrade ChatGPT, or use a BYOK provider
                            (OpenAI API key / OpenRouter).
                        </p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

/** Whether ChatGPT (subscription) should appear in provider pickers. */
export function useChatGPTProviderVisible(): boolean {
    const { settings } = useSettings();
    const { isAuthenticated } = useLoginWithChatGPT();
    return settings.chatgptLoginEnabled === true && isAuthenticated;
}
