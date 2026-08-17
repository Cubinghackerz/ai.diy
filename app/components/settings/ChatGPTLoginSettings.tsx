/**
 * Login with ChatGPT subscription for Settings and first-run setup.
 */

import { LoginWithChatGPT, useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { ChatGPTConnectionRefreshDialog } from "~/components/settings/ChatGPTConnectionRefreshDialog";

export function ChatGPTLoginSettings() {
    const { settings, updateSettings, updateProvider } = useSettings();
    const enabled = settings.chatgptLoginEnabled === true;
    const { status, isAuthenticated, user, logout } = useLoginWithChatGPT();
    const wasAuth = useRef(false);
    const syncedModels = useRef(false);
    const [refreshOpen, setRefreshOpen] = useState(false);

    const markChatGPTReady = useCallback(() => {
        updateProvider("chatgpt", { enabled: true });
        syncedModels.current = true;
    }, [updateProvider]);

    useEffect(() => {
        if (!enabled) return;
        if (isAuthenticated) {
            wasAuth.current = true;
            if (!syncedModels.current) {
                markChatGPTReady();
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
        }
    }, [enabled, isAuthenticated, status, markChatGPTReady, updateProvider]);

    const planLabel = user?.plan?.trim() || null;
    const isFreePlan = /free/i.test(planLabel ?? "");

    return (
        <>
            <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
                <div className="min-w-0">
                    <p className="text-xs font-medium">
                        ChatGPT subscription
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Uses your ChatGPT plan through this server (HttpOnly session).
                        Local restarts keep you signed in. Multi-instance hosts need
                        LWC_SECRET. Not an official OpenAI product. Disconnect anytime.
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
                            markChatGPTReady();
                            setRefreshOpen(true);
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
            <ChatGPTConnectionRefreshDialog
                open={refreshOpen}
                onOpenChange={setRefreshOpen}
                onRefresh={() => window.location.reload()}
            />
        </>
    );
}

/** Whether ChatGPT (subscription) should appear in provider pickers. */
export function useChatGPTProviderVisible(): boolean {
    return true;
}
