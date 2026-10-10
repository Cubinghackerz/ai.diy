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
    deviceCodeDeadline,
    describeChatGPTError,
    pollDelayMs,
    serverClockSkewMs,
    shouldFailLostSession,
} from "~/lib/chatgpt-errors";
import { useSettings } from "~/lib/providers/SettingsProvider";

const BASE = "/api/chatgpt";
const WINDOW_TARGET = "login-with-chatgpt";
const CONNECTED_KEY = "prismium:chatgpt-connected";
const REVALIDATE_MIN_GAP_MS = 60_000;
const REVALIDATE_INTERVAL_MS = 15 * 60_000;
const MAX_POLL_FAILURES = 8;
/** Every call to our own API is bounded: a hung request must never freeze the UI. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Starting a sign-in asks OpenAI for a code, which can be slower than a status check. */
const LOGIN_TIMEOUT_MS = 30_000;
const CLIPBOARD_TIMEOUT_MS = 1_500;
const LOGIN_ATTEMPTS = 2;
const LOGIN_RETRY_DELAY_MS = 1_200;

export type ChatGPTUser = {
    accountId: string;
    email?: string;
    name?: string;
    plan?: string;
};

export type ChatGPTSessionStatus =
    "loading" | "unauthenticated" | "starting" | "pending" | "authenticated" | "expired" | "error";

export type ChatGPTVerifyState = {
    state: "idle" | "running" | "ok" | "error";
    models?: number;
    /** The account's model ids as OpenAI listed them (unsorted). */
    slugs?: string[];
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
    /** Neither the clipboard API nor the fallback could copy the code. */
    copyFailed: boolean;
    error?: string;
    /** Last background check couldn't reach the server; last known state is kept. */
    offline: boolean;
    /** The host can't keep sign-ins across restarts (serverless without Redis + LWC_SECRET). */
    ephemeral: boolean;
    verify: ChatGPTVerifyState;
};

type RemoteSession = {
    status?: string;
    persistence?: "durable" | "ephemeral";
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
    copyFailed: false,
    offline: false,
    ephemeral: false,
    verify: { state: "idle" },
};

const ChatGPTSessionContext = createContext<ChatGPTSessionContextValue | null>(null);

type ApiResult<T> = {
    ok: boolean;
    status: number;
    data: T | null;
    /** Server clock from the `Date` response header, for expiry math. */
    serverDate: string | null;
};

async function api<T>(
    path: string,
    init?: RequestInit,
    timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<ApiResult<T>> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${BASE}${path}`, {
            credentials: "same-origin",
            cache: "no-store",
            ...init,
            signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as T | null;
        return {
            ok: response.ok,
            status: response.status,
            data,
            serverDate: response.headers.get("date"),
        };
    } finally {
        window.clearTimeout(timer);
    }
}

/** Plain-language reason a request threw (it never reached a response). */
function describeRequestFailure(error: unknown): string {
    if (error instanceof DOMException && error.name === "AbortError") {
        return "OpenAI is taking too long to respond. Try again in a moment.";
    }
    return "Couldn't reach the server. Check your connection and try again.";
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

/** Last resort for pages where the async clipboard API is missing (plain-http self-hosting). */
function copyWithSelection(text: string): boolean {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.setAttribute("aria-hidden", "true");
    field.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(field);
    try {
        field.select();
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        field.remove();
    }
}

/** Never throws and never hangs: a permission prompt that is never answered must not block sign-in. */
async function writeClipboard(text: string): Promise<boolean> {
    try {
        const write = navigator.clipboard?.writeText(text);
        if (write) {
            const copied = await Promise.race([
                write.then(() => true),
                sleep(CLIPBOARD_TIMEOUT_MS).then(() => false),
            ]);
            if (copied) return true;
        }
    } catch {
        /* denied, unfocused, or insecure context — try the fallback */
    }
    return copyWithSelection(text);
}

export function ChatGPTSessionProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SessionState>(INITIAL);
    const stateRef = useRef(state);
    stateRef.current = state;

    const popupRef = useRef<Window | null>(null);
    const pollStopRef = useRef<(() => void) | null>(null);
    const refreshRef = useRef<Promise<ChatGPTSessionStatus> | null>(null);
    /**
     * Bumped whenever a sign-in starts, ends or is cancelled. Async work from an
     * older attempt compares against it and drops its result, so a slow response
     * can never resurrect a flow the user already cancelled.
     */
    const loginRunRef = useRef(0);
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
            if (data?.persistence) {
                const ephemeral = data.persistence === "ephemeral";
                if (ephemeral !== stateRef.current.ephemeral)
                    setState((prev) => ({ ...prev, ephemeral }));
            }
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
            const res = await api<{ models?: unknown; message?: string; error?: string }>(
                "/models",
            );
            if (res.ok && Array.isArray(res.data?.models)) {
                const slugs = res.data.models.filter(
                    (item): item is string => typeof item === "string",
                );
                setState((prev) => ({
                    ...prev,
                    verify: { state: "ok", models: slugs.length, slugs },
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
                    message: res.data?.message || describeChatGPTError(res.data?.error).message,
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
                    // Anything else (403 from a proxy, 404 mid-deploy, 429, 5xx) says
                    // nothing about the session: retry and keep the last known state.
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
            loginRunRef.current += 1;
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
                copyFailed: false,
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
            loginRunRef.current += 1;
            stopPolling();
            closePopup();
            setState((prev) => ({
                ...prev,
                status: baseStatus(),
                userCode: undefined,
                verificationUrl: undefined,
                expiresAt: undefined,
                copied: false,
                copyFailed: false,
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

            const tick = async () => {
                // visibilitychange and focus both fire on return-from-popup; one
                // poll in flight at a time keeps the device-code advance single.
                if (!active || inflight) return;
                inflight = true;
                try {
                    if (Date.now() >= expiresAt + 5000) {
                        failLogin(
                            "That code expired before it was approved. Start again for a fresh one.",
                        );
                        return;
                    }
                    try {
                        const res = await api<RemoteSession>("/status");
                        if (!active) return;
                        if (res.ok && res.data?.status === "authenticated") {
                            finishConnected(res.data.user);
                            return;
                        }
                        if (
                            res.ok &&
                            (res.data?.status === "expired" || res.data?.status === "error")
                        ) {
                            failLogin(
                                "That code expired before it was approved. Start again for a fresh one.",
                            );
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
                        failLogin(
                            "Lost connection to the server while waiting for approval. Try again.",
                        );
                        return;
                    }
                } finally {
                    inflight = false;
                    if (active)
                        timer = window.setTimeout(tick, pollDelayMs(intervalSeconds, failures));
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

        const run = (loginRunRef.current += 1);
        const isCurrent = () => loginRunRef.current === run;

        // Open synchronously so the browser attributes it to the click.
        const popup = openAuthWindow();
        popupRef.current = popup;
        setState((prev) => ({
            ...prev,
            status: "starting",
            error: undefined,
            copied: false,
            copyFailed: false,
            popupBlocked: popup === null,
        }));

        /** One automatic retry: OpenAI's code endpoint occasionally answers 5xx or stalls. */
        const requestCode = async (): Promise<ApiResult<LoginResponse>> => {
            let lastFailure: unknown;
            for (let attempt = 0; attempt < LOGIN_ATTEMPTS; attempt += 1) {
                try {
                    const res = await api<LoginResponse>(
                        "/login",
                        { method: "POST" },
                        LOGIN_TIMEOUT_MS,
                    );
                    lastFailure = undefined;
                    const retryable = !res.ok && describeChatGPTError(res.data?.error).retryable;
                    if (!retryable || attempt === LOGIN_ATTEMPTS - 1) return res;
                } catch (error) {
                    lastFailure = error;
                    if (attempt === LOGIN_ATTEMPTS - 1) throw error;
                }
                await sleep(LOGIN_RETRY_DELAY_MS);
                if (!isCurrent()) throw new DOMException("Superseded", "AbortError");
            }
            throw lastFailure ?? new Error("Couldn't start ChatGPT sign-in.");
        };

        void (async () => {
            try {
                const res = await requestCode();
                if (!isCurrent()) return;
                const data = res.data;
                if (res.ok && data?.status === "authenticated") {
                    // Another tab (or an earlier click) already signed in: keep that session.
                    finishConnected(data.user);
                    return;
                }
                if (!res.ok || !data?.userCode || !data.verificationUrl) {
                    throw new Error(data?.message || describeChatGPTError(data?.error).message);
                }

                // Navigate and start polling first: neither depends on the clipboard.
                const target = data.verificationUrl;
                if (popup && !popup.closed) {
                    try {
                        popup.location.assign(target);
                        popup.focus();
                    } catch {
                        popupRef.current = window.open(target, WINDOW_TARGET);
                    }
                } else if (popup === null) {
                    popupRef.current = null;
                }
                const now = Date.now();
                const expiresAt = deviceCodeDeadline(
                    data.expiresAt,
                    serverClockSkewMs(res.serverDate, now),
                    now,
                );
                setState((prev) => ({
                    ...prev,
                    status: "pending",
                    userCode: data.userCode,
                    verificationUrl: target,
                    expiresAt,
                    copied: false,
                    copyFailed: false,
                }));
                startPolling(expiresAt, data.interval ?? 5);

                void writeClipboard(data.userCode).then((copied) => {
                    if (!isCurrent()) return;
                    setState((prev) =>
                        prev.status === "pending" && prev.userCode === data.userCode
                            ? { ...prev, copied, copyFailed: !copied }
                            : prev,
                    );
                });
            } catch (error) {
                if (!isCurrent()) return;
                const message =
                    error instanceof Error && error.name !== "AbortError" && error.message
                        ? error.message
                        : describeRequestFailure(error);
                failLogin(message);
            }
        })();
    }, [failLogin, finishConnected, startPolling]);

    const cancel = useCallback(() => {
        loginRunRef.current += 1;
        stopPolling();
        closePopup();
        setState((prev) => ({
            ...prev,
            status: baseStatus(),
            userCode: undefined,
            verificationUrl: undefined,
            expiresAt: undefined,
            copied: false,
            copyFailed: false,
            popupBlocked: false,
            error: undefined,
        }));
    }, [baseStatus, closePopup, stopPolling]);

    const logout = useCallback(async () => {
        loginRunRef.current += 1;
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
        const copied = await writeClipboard(code);
        setState((prev) =>
            prev.userCode === code ? { ...prev, copied, copyFailed: !copied } : prev,
        );
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

    // Another tab signing in or out writes this flag; pick the change up now rather
    // than at the next 15-minute check.
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === CONNECTED_KEY) void refreshInternal();
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
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
