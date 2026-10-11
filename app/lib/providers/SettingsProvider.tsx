/**
 * SettingsProvider — Client-side BYOK settings context
 *
 * Manages provider API keys, chat settings, theme, tool config, and MCP servers.
 * Settings are encrypted at rest with AES-GCM (see settings-crypto): the payload
 * lives in localStorage as ciphertext, the envelope key in IndexedDB, with a
 * backup ciphertext copy and a plaintext theme mirror for the pre-hydration
 * script. API keys are never persisted by the server, and the encrypted at-rest
 * payload is not a substitute for device security.
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useLayoutEffect,
    useCallback,
    useMemo,
    useRef,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import { PersistenceToast } from "~/components/ui/StorageNotices";
import {
    clearStorageIssue,
    observeStorage,
    reportStorageFailure,
    requestPersistentStorage,
} from "~/lib/storage-notices";
import {
    DEFAULT_SETTINGS,
    DEFAULT_MODELS,
    FREE_SEARCH_MCP_PRESETS,
    type AppSettings,
    type ProviderId,
    type ProviderConfig,
    type ChatSettings,
    type InterfaceMode,
    type McpServerConfig,
} from "~/lib/types";
import {
    SETTINGS_STORAGE_KEY,
    SETTINGS_ENC_KEY,
    SETTINGS_ENC_BACKUP_KEY,
    SETTINGS_SETUP_DONE_KEY,
    SETTINGS_THEME_KEY,
    settingsCryptoAvailable,
    encryptSettingsPayload,
    decryptSettingsPayload,
    clearSettingsEnvelopeKey,
} from "~/lib/settings-crypto";
import { DEFAULT_TOOL_ACCESS, normalizeToolAccess, type ToolAccessKey } from "~/lib/tool-access";
import { getThemeOverride } from "~/lib/theme-override";

interface SettingsContextValue {
    settings: AppSettings;
    loaded: boolean;
    updateSettings: (patch: Partial<AppSettings>) => void;
    updateToolAccess: (key: ToolAccessKey, enabled: boolean) => void;
    updateProvider: (id: ProviderId, patch: Partial<ProviderConfig>) => void;
    updateChat: (patch: Partial<ChatSettings>) => void;
    addMcpServer: (server: McpServerConfig) => void;
    removeMcpServer: (id: string) => void;
    updateMcpServer: (id: string, patch: Partial<McpServerConfig>) => void;
    resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** True when every key in `patch` already holds the same value in `target`. */
function patchIsNoop<T extends object>(target: T | undefined, patch: Partial<T>): boolean {
    if (!target) return false;
    return (Object.keys(patch) as Array<keyof T>).every((key) =>
        Object.is(target[key], patch[key]),
    );
}

/**
 * A tiny external mirror of the settings state.
 *
 * `useSettings()` re-renders its component on every settings change, which is
 * right for most UI but costly for the chat runtime: every keystroke in a
 * settings field used to re-render it. Components that only need a slice read it
 * through `useSettingsSelector`, which re-renders only when that slice changes.
 */
type SettingsStore = {
    get: () => AppSettings;
    set: (next: AppSettings) => void;
    subscribe: (listener: () => void) => () => void;
};

function createSettingsStore(initial: AppSettings): SettingsStore {
    let state = initial;
    const listeners = new Set<() => void>();
    return {
        get: () => state,
        set: (next) => {
            if (Object.is(next, state)) return;
            state = next;
            for (const listener of [...listeners]) listener();
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

const SettingsStoreContext = createContext<SettingsStore | null>(null);

const SettingsLoadedContext = createContext(false);
type SettingsActions = Omit<SettingsContextValue, "settings" | "loaded">;
const SettingsActionsContext = createContext<SettingsActions | null>(null);

/** Whether stored settings have finished loading. Changes once; never on a settings write. */
export function useSettingsLoaded(): boolean {
    return useContext(SettingsLoadedContext);
}

/** The interface the user chose ("simple" for new users, "full" for existing ones). */
export function useInterfaceMode(): InterfaceMode {
    return useSettingsSelector((settings) => settings.interfaceMode);
}

/** The settings updaters. Their identities never change, so using them never re-renders. */
export function useSettingsActions(): SettingsActions {
    const actions = useContext(SettingsActionsContext);
    if (!actions) throw new Error("useSettingsActions must be used within SettingsProvider");
    return actions;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function useSettingsStore(): SettingsStore {
    const store = useContext(SettingsStoreContext);
    if (!store) throw new Error("useSettingsSelector must be used within SettingsProvider");
    return store;
}

/** Re-renders only when `selector(settings)` changes (by `isEqual`, default `Object.is`). */
export function useSettingsSelector<T>(
    selector: (settings: AppSettings) => T,
    isEqual: (a: T, b: T) => boolean = Object.is,
): T {
    const store = useSettingsStore();
    const cache = useRef<{ source: AppSettings; value: T } | null>(null);
    const getSnapshot = () => {
        const source = store.get();
        const cached = cache.current;
        if (cached && cached.source === source) return cached.value;
        const value = selector(source);
        if (cached && isEqual(cached.value, value)) {
            cache.current = { source, value: cached.value };
            return cached.value;
        }
        cache.current = { source, value };
        return value;
    };
    return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** The latest settings, read on demand (for callbacks and refs) without subscribing. */
export function useSettingsGetter(): () => AppSettings {
    return useSettingsStore().get;
}

/** Merge persisted settings over defaults, preserving free-search MCP presets. */
function mergeLoadedSettings(parsed: Partial<AppSettings>): AppSettings {
    const storedMcpServers = parsed.mcpServers ?? [];
    const mcpServers: McpServerConfig[] = [
        ...FREE_SEARCH_MCP_PRESETS.filter(
            (preset) =>
                !storedMcpServers.some(
                    (server) =>
                        server.url?.trim().toLowerCase() === preset.url?.trim().toLowerCase(),
                ),
        ),
        ...storedMcpServers,
    ];
    const toolAccess = normalizeToolAccess(parsed.toolAccess, {
        ...DEFAULT_TOOL_ACCESS,
        webSearch: parsed.webSearchEnabled ?? DEFAULT_TOOL_ACCESS.webSearch,
        calculator: parsed.calculatorEnabled ?? DEFAULT_TOOL_ACCESS.calculator,
        python: parsed.pythonEnabled ?? DEFAULT_TOOL_ACCESS.python,
        linux: parsed.linuxEnvironment ?? DEFAULT_TOOL_ACCESS.linux,
        skills: parsed.skillsEnabled ?? DEFAULT_TOOL_ACCESS.skills,
        memory: parsed.memoryEnabled ?? DEFAULT_TOOL_ACCESS.memory,
        knowledge: parsed.knowledgeEnabled ?? DEFAULT_TOOL_ACCESS.knowledge,
        subagents: parsed.subagentsEnabled ?? DEFAULT_TOOL_ACCESS.subagents,
    });
    const loadedChat = {
        ...DEFAULT_SETTINGS.chat,
        ...parsed.chat,
        lastModelsByProvider: {
            ...DEFAULT_SETTINGS.chat.lastModelsByProvider,
            ...(parsed.chat?.provider && parsed.chat?.model
                ? { [parsed.chat.provider]: parsed.chat.model }
                : {}),
            ...parsed.chat?.lastModelsByProvider,
        },
    };
    const savedGrokModel =
        loadedChat.lastModelsByProvider?.grok ||
        (loadedChat.provider === "grok" ? loadedChat.model : "");
    const grokModel =
        savedGrokModel && savedGrokModel !== "grok-build"
            ? savedGrokModel
            : DEFAULT_MODELS.grok[0]?.id || "grok-4.6";
    const chat =
        loadedChat.provider === "grok" || loadedChat.lastModelsByProvider?.grok
            ? {
                  ...loadedChat,
                  model: loadedChat.provider === "grok" ? grokModel : loadedChat.model,
                  lastModelsByProvider: {
                      ...loadedChat.lastModelsByProvider,
                      grok: grokModel,
                  },
              }
            : loadedChat;

    return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        mcpServers,
        chat,
        providers: {
            ...DEFAULT_SETTINGS.providers,
            ...parsed.providers,
        },
        connectors: parsed.connectors ?? [],
        composio: {
            ...DEFAULT_SETTINGS.composio,
            ...(parsed.composio ?? {}),
            mcpHeaders:
                parsed.composio?.mcpHeaders && typeof parsed.composio.mcpHeaders === "object"
                    ? parsed.composio.mcpHeaders
                    : DEFAULT_SETTINGS.composio.mcpHeaders,
            autoApproveWrites: parsed.composio?.autoApproveWrites === true,
            tipDismissed: parsed.composio?.tipDismissed === true,
        },
        customSkills: parsed.customSkills ?? [],
        // Someone who already finished setup keeps the interface they know.
        interfaceMode:
            parsed.interfaceMode === "simple" || parsed.interfaceMode === "full"
                ? parsed.interfaceMode
                : parsed.setupComplete
                  ? "full"
                  : "simple",
        agentModeEnabled: parsed.agentModeEnabled ?? false,
        webSearchEnabled: toolAccess.webSearch,
        calculatorEnabled: toolAccess.calculator,
        pythonEnabled: toolAccess.python,
        skillsEnabled: toolAccess.skills,
        memoryEnabled: toolAccess.memory,
        memoryAutoAttach: parsed.memoryAutoAttach ?? false,
        knowledgeEnabled: toolAccess.knowledge,
        linuxEnvironment: toolAccess.linux,
        subagentsEnabled: toolAccess.subagents,
        toolAccess,
        chatgptLoginEnabled: parsed.chatgptLoginEnabled ?? false,
        grokBuildLoginEnabled: parsed.grokBuildLoginEnabled ?? false,
        kimiLoginEnabled: parsed.kimiLoginEnabled ?? false,
        computerModeEnabled: parsed.computerModeEnabled ?? false,
        tokenMode:
            parsed.tokenMode === "efficient" ||
            parsed.tokenMode === "balanced" ||
            parsed.tokenMode === "caching" ||
            parsed.tokenMode === "full"
                ? parsed.tokenMode
                : "balanced",
        usageLimits: {
            ...DEFAULT_SETTINGS.usageLimits,
            ...parsed.usageLimits,
        },
    };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [loaded, setLoaded] = useState(false);
    const storeRef = useRef<SettingsStore | null>(null);
    storeRef.current ??= createSettingsStore(DEFAULT_SETTINGS);
    const store = storeRef.current;
    useIsomorphicLayoutEffect(() => {
        store.set(settings);
    }, [store, settings]);
    // True when stored ciphertext exists but cannot be decrypted. While in
    // recovery mode the unreadable payload is never overwritten.
    const recoveryRef = useRef(false);
    // Latest settings snapshot, so queued async saves never write stale data.
    const latestRef = useRef<AppSettings>(DEFAULT_SETTINGS);
    const persistChainRef = useRef<Promise<void>>(Promise.resolve());

    // Load settings from storage on mount: encrypted payload → backup → legacy
    // plaintext → defaults. If the ciphertext cannot be decrypted, enter
    // recovery mode (and still prefer any legacy plaintext that exists).
    useEffect(() => {
        let cancelled = false;

        async function loadSettings() {
            if (settingsCryptoAvailable()) {
                const encrypted = localStorage.getItem(SETTINGS_ENC_KEY);
                if (encrypted) {
                    const decrypted = await decryptSettingsPayload(encrypted);
                    if (decrypted !== null) {
                        if (!cancelled) {
                            setSettings(mergeLoadedSettings(decrypted as Partial<AppSettings>));
                            setLoaded(true);
                        }
                        return;
                    }
                    const backup = localStorage.getItem(SETTINGS_ENC_BACKUP_KEY);
                    if (backup) {
                        const backupDecrypted = await decryptSettingsPayload(backup);
                        if (backupDecrypted !== null) {
                            if (!cancelled) {
                                setSettings(
                                    mergeLoadedSettings(backupDecrypted as Partial<AppSettings>),
                                );
                                setLoaded(true);
                            }
                            return;
                        }
                    }
                    // Ciphertext exists but is unreadable — never overwrite it.
                    recoveryRef.current = true;
                }
            }

            const legacyRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (legacyRaw) {
                try {
                    const parsed = JSON.parse(legacyRaw) as Partial<AppSettings>;
                    if (!cancelled) {
                        setSettings(mergeLoadedSettings(parsed));
                        setLoaded(true);
                    }
                    return;
                } catch {
                    // Malformed legacy data — fall through to defaults.
                }
            }

            if (!cancelled) {
                setSettings(DEFAULT_SETTINGS);
                setLoaded(true);
            }
        }

        void loadSettings().catch((error) => {
            recoveryRef.current = true;
            reportStorageFailure("settings-load", "Settings", error);
            if (!cancelled) setLoaded(true);
        });
        void requestPersistentStorage();
        return () => {
            cancelled = true;
        };
    }, []);

    // Persist settings on change, serialized through a promise chain so async
    // encryption can never race or write out of order.
    useEffect(() => {
        if (!loaded) return;
        latestRef.current = settings;
        persistChainRef.current = persistChainRef.current
            .then(() =>
                observeStorage("settings-save", "Settings", () =>
                    persistSettings(latestRef.current),
                ),
            )
            .catch(() => {
                // Persistence failure must never crash the UI.
            });
    }, [settings, loaded]);

    async function persistSettings(value: AppSettings): Promise<void> {
        try {
            // Theme stays plaintext for the pre-hydration theme script.
            localStorage.setItem(SETTINGS_THEME_KEY, value.theme);
            clearStorageIssue("settings-theme");
        } catch (error) {
            // Storage unavailable — keep going in memory only.
            reportStorageFailure("settings-theme", "Settings", error);
        }
        try {
            if (value.setupComplete) localStorage.setItem(SETTINGS_SETUP_DONE_KEY, "1");
        } catch {
            // Only a convenience for the landing page; never worth a warning.
        }
        if (recoveryRef.current) {
            reportStorageFailure("settings-recovery", "Settings", {
                name: "SettingsRecoveryError",
            });
            return;
        }
        if (!settingsCryptoAvailable()) {
            // No Web Crypto / IndexedDB — fall back to plaintext.
            try {
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
            } catch (error) {
                // Persist failure — settings stay in memory.
                throw error;
            }
            return;
        }
        try {
            const encrypted = await encryptSettingsPayload(value);
            if (encrypted === null)
                throw new DOMException("Settings encryption unavailable", "InvalidStateError");
            const previous = localStorage.getItem(SETTINGS_ENC_KEY);
            if (previous) {
                try {
                    localStorage.setItem(SETTINGS_ENC_BACKUP_KEY, previous);
                    clearStorageIssue("settings-backup");
                } catch (error) {
                    // Backup full — proceed with the new payload anyway.
                    reportStorageFailure("settings-backup", "Settings backup", error);
                }
            }
            try {
                localStorage.setItem(SETTINGS_ENC_KEY, encrypted);
            } catch (error) {
                throw error;
            }
            // Legacy plaintext is gone only after encryption succeeded.
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
        } catch (error) {
            // Persist failure — settings stay in memory.
            throw error;
        }
    }

    // Apply the selected workspace theme.
    useEffect(() => {
        if (!loaded) return;
        const root = document.documentElement;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const applyTheme = () => {
            const override = getThemeOverride();
            const dark =
                override ??
                (settings.theme === "dark" ||
                    settings.theme === "oled" ||
                    (settings.theme === "system" && mq.matches));
            root.classList.toggle("dark", dark);
            root.classList.toggle("oled", override ? dark : settings.theme === "oled");
        };
        applyTheme();
        if (settings.theme !== "system") return;
        mq.addEventListener("change", applyTheme);
        return () => mq.removeEventListener("change", applyTheme);
    }, [settings.theme, loaded]);

    // Updaters return `prev` when nothing changes. Sections such as the Grok/Kimi
    // sign-in cards re-assert their toggles every time they mount; without this
    // each of those calls re-rendered every settings consumer and queued another
    // encrypt + write, which is what made opening Settings stutter.
    const updateSettings = useCallback((patch: Partial<AppSettings>) => {
        setSettings((prev) => (patchIsNoop(prev, patch) ? prev : { ...prev, ...patch }));
    }, []);

    const updateToolAccess = useCallback((key: ToolAccessKey, enabled: boolean) => {
        setSettings((prev) => ({
            ...prev,
            toolAccess: { ...prev.toolAccess, [key]: enabled },
            ...(key === "webSearch" ? { webSearchEnabled: enabled } : {}),
            ...(key === "calculator" ? { calculatorEnabled: enabled } : {}),
            ...(key === "python" ? { pythonEnabled: enabled } : {}),
            ...(key === "linux" ? { linuxEnvironment: enabled } : {}),
            ...(key === "skills" ? { skillsEnabled: enabled } : {}),
            ...(key === "memory" ? { memoryEnabled: enabled } : {}),
            ...(key === "knowledge" ? { knowledgeEnabled: enabled } : {}),
            ...(key === "subagents" ? { subagentsEnabled: enabled } : {}),
        }));
    }, []);

    const updateProvider = useCallback((id: ProviderId, patch: Partial<ProviderConfig>) => {
        setSettings((prev) =>
            patchIsNoop(prev.providers[id], patch)
                ? prev
                : {
                      ...prev,
                      providers: {
                          ...prev.providers,
                          [id]: { ...prev.providers[id], ...patch },
                      },
                  },
        );
    }, []);

    const updateChat = useCallback((patch: Partial<ChatSettings>) => {
        setSettings((prev) => {
            const chat = { ...prev.chat, ...patch };
            const provider = chat.provider;
            const model = chat.model?.trim();
            if (provider && model) {
                chat.lastModelsByProvider = {
                    ...prev.chat.lastModelsByProvider,
                    ...patch.lastModelsByProvider,
                    [provider]: model,
                };
            }
            const remembered =
                !provider || !model || prev.chat.lastModelsByProvider?.[provider] === model;
            if (remembered && patchIsNoop(prev.chat, patch)) return prev;
            return { ...prev, chat };
        });
    }, []);

    const addMcpServer = useCallback((server: McpServerConfig) => {
        setSettings((prev) => ({
            ...prev,
            mcpServers: [...prev.mcpServers, server],
        }));
    }, []);

    const removeMcpServer = useCallback((id: string) => {
        setSettings((prev) => ({
            ...prev,
            mcpServers: prev.mcpServers.filter((s) => s.id !== id),
        }));
    }, []);

    const updateMcpServer = useCallback((id: string, patch: Partial<McpServerConfig>) => {
        setSettings((prev) => ({
            ...prev,
            mcpServers: prev.mcpServers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        }));
    }, []);

    const resetSettings = useCallback(() => {
        const previousComposio = latestRef.current.composio;
        recoveryRef.current = false;
        latestRef.current = DEFAULT_SETTINGS;
        setSettings(DEFAULT_SETTINGS);
        if (previousComposio.apiKey && previousComposio.sessionId) {
            void fetch("/api/composio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    action: "remove",
                    apiKey: previousComposio.apiKey,
                    userId: previousComposio.userId || undefined,
                    sessionId: previousComposio.sessionId,
                }),
            }).catch(() => undefined);
        }
        try {
            localStorage.removeItem(SETTINGS_ENC_KEY);
            localStorage.removeItem(SETTINGS_ENC_BACKUP_KEY);
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
            localStorage.removeItem(SETTINGS_THEME_KEY);
            localStorage.removeItem(SETTINGS_SETUP_DONE_KEY);
            for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
                const key = sessionStorage.key(index);
                if (key?.startsWith("aidiy.composio.catalog.")) {
                    sessionStorage.removeItem(key);
                }
            }
        } catch {
            // Ignore
        }
        void clearSettingsEnvelopeKey();
    }, []);

    const value = useMemo<SettingsContextValue>(
        () => ({
            settings,
            loaded,
            updateSettings,
            updateToolAccess,
            updateProvider,
            updateChat,
            addMcpServer,
            removeMcpServer,
            updateMcpServer,
            resetSettings,
        }),
        [
            settings,
            loaded,
            updateSettings,
            updateToolAccess,
            updateProvider,
            updateChat,
            addMcpServer,
            removeMcpServer,
            updateMcpServer,
            resetSettings,
        ],
    );

    const actions = useMemo<SettingsActions>(
        () => ({
            updateSettings,
            updateToolAccess,
            updateProvider,
            updateChat,
            addMcpServer,
            removeMcpServer,
            updateMcpServer,
            resetSettings,
        }),
        [
            updateSettings,
            updateToolAccess,
            updateProvider,
            updateChat,
            addMcpServer,
            removeMcpServer,
            updateMcpServer,
            resetSettings,
        ],
    );

    return (
        <SettingsStoreContext.Provider value={store}>
            <SettingsActionsContext.Provider value={actions}>
                <SettingsLoadedContext.Provider value={loaded}>
                    <SettingsContext.Provider value={value}>
                        <PersistenceToast />
                        {children}
                    </SettingsContext.Provider>
                </SettingsLoadedContext.Provider>
            </SettingsActionsContext.Provider>
        </SettingsStoreContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
    return ctx;
}
