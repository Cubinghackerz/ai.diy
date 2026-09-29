/**
 * One shared Login with ChatGPT session for the whole app.
 *
 * Replaces per-component `useLoginWithChatGPT()` instances (which never saw
 * each other's state and forced a page reload after sign-in). Owns the
 * device-code flow, polling, background revalidation, and a real connection
 * check, and keeps the ChatGPT provider setting in sync with the session.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    LOST_SESSION_MESSAGE,
    describeChatGPTError,
    shouldFailLostSession,
} from "~/lib/chatgpt-errors";
import { useSettings } from "~/lib/providers/SettingsProvider";

const BASE = "/api/chatgpt";
const WINDOW_TARGET = "login-with-chatgpt";
const CONNECTED_KEY = "prismium:chatgpt-connected";
const REVALIDATE_MIN_GAP_MS = 60_000;
const REVALIDATE_INTERVAL_MS = 15 * 60_000;
const MAX_POLL_FAILURES = 8;

export type ChatGPTUser = {
    accountId: string;
    email?: string;
    name?: string;
    plan?: string;
};

export type ChatGPTSessionStatus =
    | "loading"
    | "unauthenticated"
    | "starting"
    | "pending"
    | "authenticated"
    | "expired"
    | "error";

export type ChatGPTVerifyState = {
    state: "idle" | "running" | "ok" | "error";
    models?: number;
    message?: string;
};

type SessionState = {
    status: ChatGPTSessionStatus;
    user?: ChatGPTUser;
    userCode?: string;
    verificationUrl?: string;
    expiresAt?: number;
    copied: boolean;
    /** The sign-in window was blocked by the browser. */
    popupBlocked: boolean;
    error?: string;
    /** Last background check couldn't reach the server; last known state is kept. */
    offline: boolean;
    verify: ChatGPTVerifyState;
};

type RemoteSession = {
    status?: string;
    user?: ChatGPTUser;
    message?: string;
    error?: string;
};

type LoginResponse = RemoteSession & {
    userCode?: string;
    verificationUrl?: string;
    interval?: number;
    expiresAt?: number;
};

export type ChatGPTSessionContextValue = SessionState & {
    isAuthenticated: boolean;
    isBusy: boolean;
    /** Must be called from a user gesture (opens the sign-in window). */
    login: () => void;
    cancel: () => void;
    logout: () => Promise<void>;
    copyCode: () => Promise<void>;
    reopen: () => void;
    refresh: () => Promise<ChatGPTSessionStatus>;
    verifyConnection: () => Promise<void>;
    onConnected: (listener: () => void) => () => void;
};

const INITIAL: SessionState = {
    status: "loading",
    copied: false,
    popupBlocked: false,
    offline: false,
    verify: { state: "idle" },
};

const ChatGPTSessionContext = createContext<ChatGPTSessionContextValue | null>(null);

async function api<T>(path: string, init?: RequestInit) {
    const response = await fetch(`${BASE}${path}`, {
        credentials: "same-origin",
        cache: "no-store",
        ...init,
    });
    const data = (await response.json().catch(() => null)) as T | null;
    return { ok: response.ok, status: response.status, data };
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function readConnectedFlag(): boolean {
    try {
        return window.localStorage.getItem(CONNECTED_KEY) === "1";
    } catch {
        return false;
    }
}

function writeConnectedFlag(value: boolean) {
    try {
        if (value) window.localStorage.setItem(CONNECTED_KEY, "1");
        else window.localStorage.removeItem(CONNECTED_KEY);
    } catch {
        /* storage unavailable — session still works, only the "expired" hint is lost */
    }
}

function openAuthWindow(): Window | null {
    const width = 520;
    const height = 720;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popup = window.open(
        "about:blank",
        WINDOW_TARGET,
        `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
    popup?.focus();
    return popup;
}

export function ChatGPTSessionProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SessionState>(INITIAL);
    const stateRef = useRef(state);
    stateRef.current = state;

    const popupRef = useRef<Window | null>(null);
    const pollStopRef = useRef<(() => void) | null>(null);
    const refreshRef = useRef<Promise<ChatGPTSessionStatus> | null>(null);
    const lastCheckRef = useRef(0);
    const listenersRef = useRef(new Set<() => void>());

    const baseStatus = useCallback(
        (): ChatGPTSessionStatus => (readConnectedFlag() ? "expired" : "unauthenticated"),
        [],
    );

    const stopPolling = useCallback(() => {
        pollStopRef.current?.();
        pollStopRef.current = null;
    }, []);

    const closePopup = useCallback(() => {
        const popup = popupRef.current;
        popupRef.current = null;
        if (popup && !popup.closed) popup.close();
    }, []);

    const settle = useCallback(
        (data: RemoteSession | null): ChatGPTSessionStatus => {
            lastCheckRef.current = Date.now();
            const inFlow = stateRef.current.status;
            if (inFlow === "pending" || inFlow === "starting") return inFlow;
            if (data?.status === "authenticated") {
                writeConnectedFlag(true);
                setState((prev) => ({
                    ...prev,
                    status: "authenticated",
                    user: data.user ?? prev.user,
                    offline: false,
                    error: undefined,
                }));
                return "authenticated";
            }
            const next: ChatGPTSessionStatus =
                data?.status === "expired" ? "expired" : baseStatus();
            setState((prev) => ({
                ...prev,
                status: next,
                user: undefined,
                offline: false,
                error: undefined,
                verify: { state: "idle" },
            }));
            return next;
        },
        [baseStatus],
    );

    const verify = useCallback(async () => {
        setState((prev) => ({ ...prev, verify: { state: "running" } }));
        try {
            const res = await api<{ models?: unknown; message?: string; error?: string }>("/models");
            if (res.ok && Array.isArray(res.data?.models)) {
                const count = res.data.models.length;
                setState((prev) => ({
                    ...prev,
                    verify: { state: "ok", models: count },
                }));
                return;
            }
            if (res.status === 401 || res.data?.error === "refresh_token_invalid") {
                await refreshInternal();
                return;
            }
            setState((prev) => ({
                ...prev,
                verify: {
                    state: "error",
                    message:
                        res.data?.message ||
                        describeChatGPTError(res.data?.error).message,
                },
            }));
        } catch {
            setState((prev) => ({
                ...prev,
                verify: {
                    state: "error",
                    message: "Couldn't reach the server to test the connection.",
                },
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshInternal = useCallback((): Promise<ChatGPTSessionStatus> => {
        const current = stateRef.current.status;
        if (current === "pending" || current === "starting") {
            return Promise.resolve(current);
        }
        if (refreshRef.current) return refreshRef.current;

        const run = (async (): Promise<ChatGPTSessionStatus> => {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    const res = await api<RemoteSession>("/session");
                    if (res.ok && res.data) return settle(res.data);
                    if (res.status === 401) return settle({ status: "unauthenticated" });
                    if (res.status < 500 && res.status !== 429) {
                        return settle({ status: "unauthenticated" });
                    }
                } catch {
                    /* network failure — retry with backoff */
                }
                if (attempt < 2) await sleep(600 * (attempt + 1) ** 2);
            }
            const before = stateRef.current.status;
            setState((prev) => ({
                ...prev,
                offline: true,
                status: prev.status === "loading" ? "error" : prev.status,
                error:
                    prev.status === "loading"
                        ? "Couldn't reach the server to check your ChatGPT session."
                        : prev.error,
            }));
            return before === "loading" ? "error" : before;
        })().finally(() => {
            refreshRef.current = null;
        });

        refreshRef.current = run;
        return run;
    }, [settle]);

    const finishConnected = useCallback(
        (user?: ChatGPTUser) => {
            stopPolling();
            closePopup();
            writeConnectedFlag(true);
            lastCheckRef.current = Date.now();
            setState((prev) => ({
                ...prev,
                status: "authenticated",
                user: user ?? prev.user,
                userCode: undefined,
                verificationUrl: undefined,
                expiresAt: undefined,
                copied: false,
                popupBlocked: false,
                offline: false,
                error: undefined,
            }));
            listenersRef.current.forEach((listener) => listener());
            void verify();
        },
        [closePopup, stopPolling, verify],
    );

    const failLogin = useCallback(
        (message: string) => {
            stopPolling();
            closePopup();
            setState((prev) => ({
                ...prev,
                status: baseStatus(),
                userCode: undefined,
                verificationUrl: undefined,
                expiresAt: undefined,
                copied: false,
                popupBlocked: false,
                error: message,
            }));
        },
        [baseStatus, closePopup, stopPolling],
    );

    const startPolling = useCallback(
        (expiresAt: number, intervalSeconds: number) => {
            stopPolling();
            let active = true;
            let inflight = false;
            let timer: number | undefined;
            let failures = 0;
            let lostStrikes = 0;
            const delay = Math.min(8000, Math.max(2000, intervalSeconds * 1000));

            const tick = async () => {
                // visibilitychange and focus both fire on return-from-popup; one
                // poll in flight at a time keeps the device-code advance single.
                if (!active || inflight) return;
                inflight = true;
                try {
                    if (Date.now() >= expiresAt + 5000) {
                        failLogin("That code expired before it was approved. Start again for a fresh one.");
                        return;
                    }
                    try {
                        const res = await api<RemoteSession>("/status");
                        if (!active) return;
                        if (res.ok && res.data?.status === "authenticated") {
                            finishConnected(res.data.user);
                            return;
                        }
                        if (res.ok && (res.data?.status === "expired" || res.data?.status === "error")) {
                            failLogin("That code expired before it was approved. Start again for a fresh one.");
                            return;
                        }
                        if (res.ok && res.data?.status === "unauthenticated") {
                            lostStrikes += 1;
                            if (shouldFailLostSession(lostStrikes)) {
                                failLogin(LOST_SESSION_MESSAGE);
                                return;
                            }
                        } else if (res.ok) {
                            lostStrikes = 0;
                        }
                        if (!res.ok) {
                            const info = describeChatGPTError(res.data?.error);
                            if (!info.retryable) {
                                failLogin(res.data?.message || info.message);
                                return;
                            }
                            failures += 1;
                        } else {
                            failures = 0;
                        }
                    } catch {
                        if (!active) return;
                        failures += 1;
                    }
                    if (failures >= MAX_POLL_FAILURES) {
                        failLogin("Lost connection to the server while waiting for approval. Try again.");
                        return;
                    }
                } finally {
                    inflight = false;
                    if (active) timer = window.setTimeout(tick, delay);
                }
            };

            const onVisible = () => {
                if (document.visibilityState !== "visible" || !active) return;
                window.clearTimeout(timer);
                void tick();
            };
            document.addEventListener("visibilitychange", onVisible);
            window.addEventListener("focus", onVisible);
            timer = window.setTimeout(tick, 1500);

            pollStopRef.current = () => {
                active = false;
                window.clearTimeout(timer);
                document.removeEventListener("visibilitychange", onVisible);
                window.removeEventListener("focus", onVisible);
            };
        },
        [failLogin, finishConnected, stopPolling],
    );

    const login = useCallback(() => {
        const current = stateRef.current.status;
        if (current === "authenticated" || current === "starting") return;
        if (current === "pending") {
            const popup = popupRef.current;
            if (popup && !popup.closed) popup.focus();
            else {
                const url = stateRef.current.verificationUrl;
                if (url) popupRef.current = window.open(url, WINDOW_TARGET);
            }
            return;
        }

        // Open synchronously so the browser attributes it to the click.
        const popup = openAuthWindow();
        popupRef.current = popup;
        setState((prev) => ({
            ...prev,
            status: "starting",
            error: undefined,
            copied: false,
            popupBlocked: popup === null,
        }));

        void (async () => {
            try {
                const res = await api<LoginResponse>("/login", { method: "POST" });
                const data = res.data;
                if (!res.ok || !data?.userCode || !data.verificationUrl) {
                    throw new Error(
                        data?.message || describeChatGPTError(data?.error).message,
                    );
                }
                let copied = false;
                try {
                    await navigator.clipboard.writeText(data.userCode);
                    copied = true;
                } catch {
                    /* clipboard denied or unfocused — code stays visible with a Copy button */
                }
                if (popup && !popup.closed) {
                    popup.location.assign(data.verificationUrl);
                    popup.focus();
                } else if (popup === null) {
                    popupRef.current = null;
                }
                const expiresAt = data.expiresAt ?? Date.now() + 15 * 60_000;
                setState((prev) => ({
                    ...prev,
                    status: "pending",
                    userCode: data.userCode,
                    verificationUrl: data.verificationUrl,
                    expiresAt,
                    copied,
                }));
                startPolling(expiresAt, data.interval ?? 5);
            } catch (error) {
                failLogin(
                    error instanceof Error && error.message
                        ? error.message
                        : "Couldn't start ChatGPT sign-in. Try again.",
                );
            }
        })();
    }, [failLogin, startPolling]);

    const cancel = useCallback(() => {
        stopPolling();
        closePopup();
        setState((prev) => ({
            ...prev,
            status: baseStatus(),
            userCode: undefined,
            verificationUrl: undefined,
            expiresAt: undefined,
            copied: false,
            popupBlocked: false,
            error: undefined,
        }));
    }, [baseStatus, closePopup, stopPolling]);

    const logout = useCallback(async () => {
        stopPolling();
        closePopup();
        writeConnectedFlag(false);
        setState({ ...INITIAL, status: "unauthenticated" });
        try {
            await api("/logout", { method: "POST" });
        } catch {
            /* best effort — the cookie is already forgotten locally */
        }
    }, [closePopup, stopPolling]);

    const copyCode = useCallback(async () => {
        const code = stateRef.current.userCode;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            setState((prev) => ({ ...prev, copied: true }));
        } catch {
            /* the code is still on screen for manual entry */
        }
    }, []);

    const reopen = useCallback(() => {
        const popup = popupRef.current;
        if (popup && !popup.closed) {
            popup.focus();
            return;
        }
        const url = stateRef.current.verificationUrl;
        if (!url) return;
        const next = window.open(url, WINDOW_TARGET);
        popupRef.current = next;
        setState((prev) => ({ ...prev, popupBlocked: next === null }));
    }, []);

    const onConnected = useCallback((listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
            listenersRef.current.delete(listener);
        };
    }, []);

    useEffect(() => {
        void refreshInternal();
    }, [refreshInternal]);

    useEffect(() => {
        const revalidate = (force = false) => {
            if (document.visibilityState !== "visible") return;
            if (!force && Date.now() - lastCheckRef.current < REVALIDATE_MIN_GAP_MS) return;
            void refreshInternal();
        };
        const onVisible = () => revalidate();
        const onOnline = () => revalidate(true);
        const interval = window.setInterval(() => revalidate(true), REVALIDATE_INTERVAL_MS);
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        window.addEventListener("online", onOnline);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
            window.removeEventListener("online", onOnline);
        };
    }, [refreshInternal]);

    useEffect(
        () => () => {
            pollStopRef.current?.();
        },
        [],
    );

    const value = useMemo<ChatGPTSessionContextValue>(
        () => ({
            ...state,
            isAuthenticated: state.status === "authenticated",
            isBusy: state.status === "starting" || state.status === "pending",
            login,
            cancel,
            logout,
            copyCode,
            reopen,
            refresh: refreshInternal,
            verifyConnection: verify,
            onConnected,
        }),
        [state, login, cancel, logout, copyCode, reopen, refreshInternal, verify, onConnected],
    );

    return (
        <ChatGPTSessionContext.Provider value={value}>
            <ChatGPTSettingsSync status={state.status} />
            {children}
        </ChatGPTSessionContext.Provider>
    );
}

/** Keeps the ChatGPT provider toggles aligned with the real server session. */
function ChatGPTSettingsSync({ status }: { status: ChatGPTSessionStatus }) {
    const { settings, loaded, updateSettings, updateProvider } = useSettings();
    const providerEnabled = settings.providers.chatgpt?.enabled === true;
    const loginEnabled = settings.chatgptLoginEnabled === true;

    useEffect(() => {
        if (!loaded) return;
        if (status === "authenticated") {
            if (!loginEnabled) updateSettings({ chatgptLoginEnabled: true });
            if (!providerEnabled) updateProvider("chatgpt", { apiKey: "", enabled: true });
        } else if (status === "expired" || status === "unauthenticated") {
            if (providerEnabled) updateProvider("chatgpt", { enabled: false });
        }
    }, [loaded, status, loginEnabled, providerEnabled, updateSettings, updateProvider]);

    return null;
}

export function useChatGPTSession(): ChatGPTSessionContextValue {
    const value = useContext(ChatGPTSessionContext);
    if (!value) {
        throw new Error("useChatGPTSession must be used inside <ChatGPTSessionProvider>.");
    }
    return value;
}

/** Runs `callback` each time a sign-in completes in this tab. */
export function useOnChatGPTConnected(callback: () => void) {
    const { onConnected } = useChatGPTSession();
    const ref = useRef(callback);
    ref.current = callback;
    useEffect(() => onConnected(() => ref.current()), [onConnected]);
}
