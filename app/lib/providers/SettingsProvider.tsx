/**
 * SettingsProvider — Client-side BYOK settings context
 *
 * Manages provider API keys, chat settings, theme, tool config, and MCP servers.
 * Persists settings locally in the browser. When encryption is enabled,
 * settings are AES-GCM encrypted with a user-supplied passphrase; the passphrase
 * itself is never persisted and must be re-entered on every fresh load.
 *
 * Storage layout:
 *   - `prismium-lite:settings` — full settings (encrypted blob or plaintext JSON)
 *   - `prismium-lite:settings-meta` — unencrypted `{ theme }` for SSR-safe theme init
 *   - `prismium-lite:settings-key-check` — verifier for the passphrase
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
    persistSettings,
    loadEncryptionPreference,
    loadSettings as loadEncryptedSettings,
    storeKeyCheck,
    verifyPassphrase,
    clearKeyCheck,
    readTheme,
    enableEncryption as enableEncryptionInStorage,
    disableEncryption as disableEncryptionInStorage,
} from "~/lib/secure-storage";

const STORAGE_KEY = "prismium-lite:settings";

interface SettingsContextValue {
    settings: AppSettings;
    /** True once the settings blob has been loaded and is ready for use. */
    loaded: boolean;
    /** True when encryption is enabled and the passphrase has not yet been entered. */
    locked: boolean;
    /** True while a passphrase verification or settings decryption is in flight. */
    unlocking: boolean;
    /** Error message from a failed passphrase attempt. */
    unlockError: string | null;
    updateSettings: (patch: Partial<AppSettings>) => void;
    updateProvider: (id: ProviderId, patch: Partial<ProviderConfig>) => void;
    updateChat: (patch: Partial<ChatSettings>) => void;
    addMcpServer: (server: McpServerConfig) => void;
    removeMcpServer: (id: string) => void;
    updateMcpServer: (id: string, patch: Partial<McpServerConfig>) => void;
    resetSettings: () => void;
    /** Decrypt settings with a passphrase (called when locked). */
    unlockWithPassphrase: (passphrase: string) => Promise<boolean>;
    /** Enable encryption with a new passphrase, re-encrypting all settings. */
    enableEncryption: (passphrase: string) => Promise<boolean>;
    /** Disable encryption, re-saving settings as plaintext. */
    disableEncryption: () => Promise<void>;
    /** Clear the current unlock error. */
    clearUnlockError: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function mergeSettings(parsed: Partial<AppSettings>): AppSettings {
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
        customPrompts: parsed.customPrompts ?? [],
        customAgents: parsed.customAgents ?? [],
        cloudStorage: {
            ...DEFAULT_SETTINGS.cloudStorage,
            ...parsed.cloudStorage,
        },
    };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [loaded, setLoaded] = useState(false);
    const [locked, setLocked] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState<string | null>(null);

    const passphraseRef = useRef<string | null>(null);
    const encryptionEnabledRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const pref = loadEncryptionPreference();
        encryptionEnabledRef.current = pref.encryptionEnabled;

        if (pref.encryptionEnabled) {
            setLocked(true);
            setLoaded(true);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw) as Partial<AppSettings>;
                        if (!cancelled) {
                            setSettings(mergeSettings(parsed));
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            } catch {
                // localStorage might be unavailable
            }
            if (!cancelled) setLoaded(true);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const persistWithEncryption = useCallback(
        async (nextSettings: AppSettings) => {
            const shouldEncrypt = encryptionEnabledRef.current;
            const pass = passphraseRef.current;
            await persistSettings(nextSettings, shouldEncrypt, pass);
        },
        [],
    );

    useEffect(() => {
        if (!loaded) return;
        if (locked) return;
        void persistWithEncryption(settings);
    }, [settings, loaded, locked, persistWithEncryption]);

    useEffect(() => {
        if (!loaded) return;
        if (locked) return;
        const root = document.documentElement;
        if (settings.theme === "dark") {
            root.classList.add("dark");
        } else if (settings.theme === "light") {
            root.classList.remove("dark");
        } else {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            if (mq.matches) root.classList.add("dark");
            else root.classList.remove("dark");
        }
    }, [settings.theme, loaded, locked]);

    const unlockWithPassphrase = useCallback(
        async (passphrase: string): Promise<boolean> => {
            setUnlocking(true);
            setUnlockError(null);
            try {
                const ok = await verifyPassphrase(passphrase);
                if (!ok) {
                    setUnlockError("Passphrase does not match. Please try again.");
                    setUnlocking(false);
                    return false;
                }

                const decrypted = await loadEncryptedSettings(true, passphrase);
                if (!decrypted) {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw) as Partial<AppSettings>;
                            setSettings(mergeSettings(parsed));
                        } catch {
                            setUnlockError(
                                "Settings could not be decrypted. The data may be corrupted.",
                            );
                            setUnlocking(false);
                            return false;
                        }
                    } else {
                        setSettings(DEFAULT_SETTINGS);
                    }
                } else {
                    setSettings(mergeSettings(decrypted));
                }

                passphraseRef.current = passphrase;
                setLocked(false);
                setUnlocking(false);
                return true;
            } catch (err) {
                setUnlockError(
                    err instanceof Error
                        ? err.message
                        : "Failed to decrypt settings.",
                );
                setUnlocking(false);
                return false;
            }
        },
        [],
    );

    const enableEncryption = useCallback(
        async (passphrase: string): Promise<boolean> => {
            setUnlocking(true);
            setUnlockError(null);
            try {
                await storeKeyCheck(passphrase);
                passphraseRef.current = passphrase;
                encryptionEnabledRef.current = true;

                await persistSettings(settings, true, passphrase);

                 setSettings((prev) => ({
                    ...prev,
                    encryptionEnabled: true,
                }));
                setLocked(false);
                setUnlocking(false);
                return true;
            } catch (err) {
                setUnlockError(
                    err instanceof Error
                        ? err.message
                        : "Failed to enable encryption.",
                );
                clearKeyCheck();
                setUnlocking(false);
                return false;
            }
        },
        [settings],
    );

    const disableEncryption = useCallback(
        async (): Promise<void> => {
            passphraseRef.current = null;
            encryptionEnabledRef.current = false;
            clearKeyCheck();
            await persistSettings(settings, false, null);
            setSettings((prev) => ({
                ...prev,
                encryptionEnabled: false,
            }));
        },
        [settings],
    );

    const clearUnlockError = useCallback(() => {
        setUnlockError(null);
    }, []);

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
        setSettings(DEFAULT_SETTINGS);
        passphraseRef.current = null;
        encryptionEnabledRef.current = false;
        clearKeyCheck();
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem("prismium-lite:settings-meta");
    }, []);

    return (
        <SettingsContext.Provider
            value={{
                settings,
                loaded,
                locked,
                unlocking,
                unlockError,
                updateSettings,
                updateProvider,
                updateChat,
                addMcpServer,
                removeMcpServer,
                updateMcpServer,
                resetSettings,
                unlockWithPassphrase,
                enableEncryption,
                disableEncryption,
                clearUnlockError,
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

/** Hook for consumers that only need to know if the vault is locked. */
export function useIsLocked(): boolean {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
    return ctx.locked;
}

/** Hook for the theme — reads from the unencrypted meta key so it works
 * even when settings are encrypted. Safe to call before React hydration. */
export function useThemeColor(): "light" | "dark" | "system" {
    const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
    useEffect(() => {
        setTheme(readTheme());
    }, []);
    return theme;
}
