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
    useCallback,
    useRef,
    type ReactNode,
} from "react";
import {
    DEFAULT_SETTINGS,
    FREE_SEARCH_MCP_PRESETS,
    type AppSettings,
    type ProviderId,
    type ProviderConfig,
    type ChatSettings,
    type McpServerConfig,
} from "~/lib/types";
import {
    SETTINGS_STORAGE_KEY,
    SETTINGS_ENC_KEY,
    SETTINGS_ENC_BACKUP_KEY,
    SETTINGS_THEME_KEY,
    settingsCryptoAvailable,
    encryptSettingsPayload,
    decryptSettingsPayload,
    clearSettingsEnvelopeKey,
} from "~/lib/settings-crypto";

interface SettingsContextValue {
    settings: AppSettings;
    loaded: boolean;
    updateSettings: (patch: Partial<AppSettings>) => void;
    updateProvider: (id: ProviderId, patch: Partial<ProviderConfig>) => void;
    updateChat: (patch: Partial<ChatSettings>) => void;
    addMcpServer: (server: McpServerConfig) => void;
    removeMcpServer: (id: string) => void;
    updateMcpServer: (id: string, patch: Partial<McpServerConfig>) => void;
    resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Merge persisted settings over defaults, preserving free-search MCP presets. */
function mergeLoadedSettings(parsed: Partial<AppSettings>): AppSettings {
    const storedMcpServers = parsed.mcpServers ?? [];
    const mcpServers: McpServerConfig[] = [
        ...FREE_SEARCH_MCP_PRESETS.filter(
            (preset) =>
                !storedMcpServers.some(
                    (server) =>
                        server.url?.trim().toLowerCase() ===
                        preset.url?.trim().toLowerCase(),
                ),
        ),
        ...storedMcpServers,
    ];
    return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        mcpServers,
        chat: {
            ...DEFAULT_SETTINGS.chat,
            ...parsed.chat,
        },
        providers: {
            ...DEFAULT_SETTINGS.providers,
            ...parsed.providers,
        },
        connectors: parsed.connectors ?? [],
        customSkills: parsed.customSkills ?? [],
        agentModeEnabled: parsed.agentModeEnabled ?? false,
        subagentsEnabled: parsed.subagentsEnabled ?? false,
        chatgptLoginEnabled: parsed.chatgptLoginEnabled ?? false,
        linuxEnvironment: parsed.linuxEnvironment ?? true,
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
                            setSettings(
                                mergeLoadedSettings(decrypted as Partial<AppSettings>),
                            );
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
                                    mergeLoadedSettings(
                                        backupDecrypted as Partial<AppSettings>,
                                    ),
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

        void loadSettings();
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
            .then(() => persistSettings(latestRef.current))
            .catch(() => {
                // Persistence failure must never crash the UI.
            });
    }, [settings, loaded]);

    async function persistSettings(value: AppSettings): Promise<void> {
        try {
            // Theme stays plaintext for the pre-hydration theme script.
            localStorage.setItem(SETTINGS_THEME_KEY, value.theme);
        } catch {
            // Storage unavailable — keep going in memory only.
        }
        if (recoveryRef.current) return;
        if (!settingsCryptoAvailable()) {
            // No Web Crypto / IndexedDB — fall back to plaintext.
            try {
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
            } catch {
                // Persist failure — settings stay in memory.
            }
            return;
        }
        try {
            const encrypted = await encryptSettingsPayload(value);
            if (encrypted === null) return;
            const previous = localStorage.getItem(SETTINGS_ENC_KEY);
            if (previous) {
                try {
                    localStorage.setItem(SETTINGS_ENC_BACKUP_KEY, previous);
                } catch {
                    // Backup full — proceed with the new payload anyway.
                }
            }
            try {
                localStorage.setItem(SETTINGS_ENC_KEY, encrypted);
            } catch {
                return;
            }
            // Legacy plaintext is gone only after encryption succeeded.
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
        } catch {
            // Persist failure — settings stay in memory.
        }
    }

    // Apply theme
    useEffect(() => {
        if (!loaded) return;
        const root = document.documentElement;
        if (settings.theme === "dark") {
            root.classList.add("dark");
        } else if (settings.theme === "light") {
            root.classList.remove("dark");
        } else {
            // System theme
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            if (mq.matches) root.classList.add("dark");
            else root.classList.remove("dark");
        }
    }, [settings.theme, loaded]);

    const updateSettings = useCallback((patch: Partial<AppSettings>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
    }, []);

    const updateProvider = useCallback((id: ProviderId, patch: Partial<ProviderConfig>) => {
        setSettings((prev) => ({
            ...prev,
            providers: {
                ...prev.providers,
                [id]: { ...prev.providers[id], ...patch },
            },
        }));
    }, []);

    const updateChat = useCallback((patch: Partial<ChatSettings>) => {
        setSettings((prev) => ({
            ...prev,
            chat: { ...prev.chat, ...patch },
        }));
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
        recoveryRef.current = false;
        setSettings(DEFAULT_SETTINGS);
        try {
            localStorage.removeItem(SETTINGS_ENC_KEY);
            localStorage.removeItem(SETTINGS_ENC_BACKUP_KEY);
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
            localStorage.removeItem(SETTINGS_THEME_KEY);
        } catch {
            // Ignore
        }
        void clearSettingsEnvelopeKey();
    }, []);

    return (
        <SettingsContext.Provider
            value={{
                settings,
                loaded,
                updateSettings,
                updateProvider,
                updateChat,
                addMcpServer,
                removeMcpServer,
                updateMcpServer,
                resetSettings,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
    return ctx;
}
