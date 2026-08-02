/**
 * SettingsProvider — Client-side BYOK settings context
 * 
 * Manages provider API keys, chat settings, theme, tool config, and MCP servers.
 * Persists to localStorage. Supports optional JWE encryption of API keys.
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";
import {
    DEFAULT_SETTINGS,
    type AppSettings,
    type ProviderId,
    type ProviderConfig,
    type ChatSettings,
    type McpServerConfig,
} from "~/lib/types";

const STORAGE_KEY = "prismium-lite:settings";

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

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [loaded, setLoaded] = useState(false);

    // Load settings from localStorage on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<AppSettings>;
                setSettings({
                    ...DEFAULT_SETTINGS,
                    ...parsed,
                    chat: {
                        ...DEFAULT_SETTINGS.chat,
                        ...parsed.chat,
                    },
                    providers: {
                        ...DEFAULT_SETTINGS.providers,
                        ...parsed.providers,
                    },
                    connectors: parsed.connectors ?? [],
                });
            }
        } catch {
            // Ignore parse errors
        }
        setLoaded(true);
    }, []);

    // Persist settings to localStorage on change
    useEffect(() => {
        if (!loaded) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch {
            // Storage might be full or unavailable
        }
    }, [settings, loaded]);

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
        setSettings(DEFAULT_SETTINGS);
        localStorage.removeItem(STORAGE_KEY);
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
