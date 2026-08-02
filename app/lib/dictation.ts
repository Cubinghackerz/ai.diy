import type { DictationAdapter } from "@assistant-ui/react";

interface SpeechRecognitionResultItem {
    transcript: string;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
}

interface SpeechRecognitionConstructor {
    new (): SpeechRecognitionInstance;
}

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
    if (typeof window === "undefined") return undefined;
    return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function isWebSpeechDictationSupported(): boolean {
    return getSpeechRecognitionConstructor() !== undefined;
}

/**
 * Browser speech services can emit `end` after silence or a transient network
 * interruption even when continuous recognition is enabled. Keep the same
 * assistant-ui session alive and restart only recoverable failures.
 */
export function createWebSpeechDictationAdapter(
    language = typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : "en-US",
): DictationAdapter {
    return {
        disableInputDuringDictation: true,
        listen() {
            const SpeechRecognitionAPI = getSpeechRecognitionConstructor();
            if (!SpeechRecognitionAPI) {
                throw new Error(
                    "Voice input is not supported in this browser. Try Chrome, Edge, or Safari.",
                );
            }

            const recognition = new SpeechRecognitionAPI();
            recognition.lang = language;
            recognition.continuous = true;
            recognition.interimResults = true;

            const speechStartCallbacks = new Set<() => void>();
            const speechEndCallbacks = new Set<
                (result: DictationAdapter.Result) => void
            >();
            const speechCallbacks = new Set<
                (result: DictationAdapter.Result) => void
            >();

            let stopped = false;
            let cancelled = false;
            let terminal = false;
            let restartTimer: ReturnType<typeof setTimeout> | undefined;
            let finalTranscript = "";

            const session: DictationAdapter.Session = {
                status: { type: "starting" },
                stop: async () => {
                    if (session.status.type === "ended") return;
                    stopped = true;
                    if (restartTimer) clearTimeout(restartTimer);
                    try {
                        recognition.stop();
                    } catch {
                        finish("stopped");
                    }
                    await Promise.race([
                        waitForEnd(),
                        new Promise<void>((resolve) => {
                            setTimeout(() => {
                                if (session.status.type !== "ended") {
                                    try {
                                        recognition.abort();
                                    } catch {
                                        // The session may already have ended.
                                    }
                                    finish("stopped");
                                }
                                resolve();
                            }, 2000);
                        }),
                    ]);
                },
                cancel: () => {
                    if (session.status.type === "ended") return;
                    cancelled = true;
                    terminal = true;
                    if (restartTimer) clearTimeout(restartTimer);
                    try {
                        recognition.abort();
                    } catch {
                        finish("cancelled");
                    }
                },
                onSpeechStart: (callback) => {
                    speechStartCallbacks.add(callback);
                    return () => speechStartCallbacks.delete(callback);
                },
                onSpeechEnd: (callback) => {
                    speechEndCallbacks.add(callback);
                    return () => speechEndCallbacks.delete(callback);
                },
                onSpeech: (callback) => {
                    speechCallbacks.add(callback);
                    return () => speechCallbacks.delete(callback);
                },
            };

            const finish = (
                reason: "stopped" | "cancelled" | "error",
            ): void => {
                if (session.status.type === "ended") return;
                terminal = true;
                if (restartTimer) clearTimeout(restartTimer);
                session.status = { type: "ended", reason };
                if (reason === "stopped" && finalTranscript) {
                    for (const callback of speechEndCallbacks) {
                        callback({ transcript: finalTranscript });
                    }
                }
                finalTranscript = "";
            };

            const waitForEnd = (): Promise<void> =>
                new Promise((resolve) => {
                    if (session.status.type === "ended") {
                        resolve();
                        return;
                    }
                    const check = () => {
                        if (session.status.type === "ended") resolve();
                        else setTimeout(check, 50);
                    };
                    check();
                });

            const restart = (): void => {
                if (terminal || stopped || cancelled || restartTimer) return;
                restartTimer = setTimeout(() => {
                    restartTimer = undefined;
                    try {
                        recognition.start();
                    } catch {
                        restart();
                    }
                }, 250);
            };

            recognition.addEventListener("speechstart", () => {
                for (const callback of speechStartCallbacks) callback();
            });

            recognition.addEventListener("start", () => {
                if (session.status.type !== "ended") {
                    session.status = { type: "running" };
                }
            });

            recognition.addEventListener("result", (event) => {
                const speechEvent = event as unknown as SpeechRecognitionEvent;
                for (
                    let index = speechEvent.resultIndex;
                    index < speechEvent.results.length;
                    index += 1
                ) {
                    const result = speechEvent.results[index];
                    const transcript = result?.[0]?.transcript ?? "";
                    if (!transcript) continue;
                    if (result.isFinal) {
                        finalTranscript += transcript;
                        for (const callback of speechCallbacks) {
                            callback({ transcript, isFinal: true });
                        }
                    } else {
                        for (const callback of speechCallbacks) {
                            callback({ transcript, isFinal: false });
                        }
                    }
                }
            });

            recognition.addEventListener("end", () => {
                if (terminal || stopped || cancelled) {
                    finish(cancelled ? "cancelled" : "stopped");
                    return;
                }
                restart();
            });

            recognition.addEventListener("error", (event) => {
                const error = event as unknown as SpeechRecognitionErrorEvent;
                const recoverable = error.error === "no-speech" || error.error === "network";
                if (error.error === "aborted") {
                    finish("cancelled");
                } else if (recoverable) {
                    restart();
                } else {
                    console.warn("Voice input ended:", error.error || error.message);
                    finish("error");
                }
            });

            try {
                recognition.start();
            } catch (error) {
                finish("error");
                throw error;
            }

            return session;
        },
    };
}
