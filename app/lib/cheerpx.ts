/**
 * In-browser Linux (CheerpX / WebVM) — client-executed, like Pyodide.
 *
 * Runtime loads from the Leaning Technologies CDN (do not self-host).
 * Persistent writes go to an IndexedDB overlay keyed by conversation scope.
 */

export type LinuxArtifact = {
    filename: string;
    content: string;
    contentEncoding: "base64";
};

export type LinuxCommandResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    /** Process id of the bash that ran the command (when tracked). */
    pid?: number;
    durationMs?: number;
};

export type LinuxClientResult = {
    output: string;
    artifacts: LinuxArtifact[];
};

export type LinuxToolName =
    | "run_command"
    | "read_file"
    | "linux_run_command"
    | "linux_read_file"
    | "linux_background_start"
    | "linux_list_processes"
    | "linux_kill_process";

type CheerpXDevice = {
    readFileAsBlob?: (path: string) => Promise<Blob>;
};

type CheerpXNetworkInterface = {
    authKey?: string;
    controlUrl?: string;
    loginUrlCb?: (url: string) => void;
    stateUpdateCb?: (state: number) => void;
    netmapUpdateCb?: (map: unknown) => void;
};

type CheerpXLinux = {
    run: (
        fileName: string,
        args: string[],
        options?: {
            env?: string[];
            cwd?: string;
            uid?: number;
            gid?: number;
        },
    ) => Promise<{ status: number }>;
    setConsole: (element: HTMLElement) => void;
    setCustomConsole: (
        writeFunc: (buf: Uint8Array, vt: number) => void,
        cols: number,
        rows: number,
    ) => (keyCode: number) => void;
    networkLogin?: () => Promise<void> | void;
};

type CheerpXNamespace = {
    Linux: {
        create: (options: {
            mounts: Array<{ type: string; path: string; dev?: CheerpXDevice }>;
            networkInterface?: CheerpXNetworkInterface;
        }) => Promise<CheerpXLinux>;
    };
    CloudDevice: { create: (url: string) => Promise<CheerpXDevice> };
    IDBDevice: { create: (name: string) => Promise<CheerpXDevice> };
    OverlayDevice: {
        create: (
            base: CheerpXDevice,
            overlay: CheerpXDevice,
        ) => Promise<CheerpXDevice>;
    };
};

type CheerpXWindow = Window & {
    CheerpXUnavailable?: boolean;
};

/** Pinned 1.x runtime. 1.3.9 fixes sequential Node process instability seen with 1.3.7. */
export const CHEERPX_VERSION = "1.3.9";
export const CHEERPX_LOADER_URL = `https://cxrtnc.leaningtech.com/${CHEERPX_VERSION}/cx.esm.js`;
/**
 * Official WebVM CloudDevice image (WebSocket block store — no GitHub/CORS).
 * The permission-fixed 2026 buster build is what webvm.io currently serves;
 * /home/user is writable and the old permission workarounds are gone.
 * Note: this stays Debian 10 — nodejs is v10 and python3 is 3.7. A modern
 * Node (20/22) would require a custom image or an HTTP FetchDevice kit.
 */
export const CHEERPX_DISK_IMAGE_URL =
    "wss://disks.webvm.io/debian_buster_large_permis_fixed_01-06-2026.ext2";
export const CHEERPX_DISK_IMAGE_HTTP_URL = CHEERPX_DISK_IMAGE_URL.replace(
    /^wss:/,
    "https:",
);
// Scope the VM overlay to a conversation. The previous shared database could
// expose files and installed packages across threads in the same tab. Include
// the image generation so an old ext2 overlay is never mounted over a new disk.
const OVERLAY_DB_BASE = "aidiy-cx-v6-cheerpx-1-3-9-debian-buster-2026-06";

const COMMAND_TIMEOUT_MS = 90_000;
const MAX_COMMAND_TIMEOUT_MS = 300_000;
const BOOT_TIMEOUT_MS = 60_000;
const SHELL_EXIT_GRACE_MS = 250;
const MAX_OUTPUT_BYTES = 32 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_CWD = "/home/user";
const LINUX_FAILURE_COOLDOWN_MS = 20_000;

const DEFAULT_ENV = [
    "HOME=/home/user",
    "USER=user",
    "SHELL=/bin/bash",
    "EDITOR=vi",
    "LANG=en_US.UTF-8",
    "LC_ALL=C",
    "TERM=xterm-256color",
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/user/bin",
];

const UNAVAILABLE_MESSAGE =
    "Linux environment is unavailable. This page is not cross-origin isolated (SharedArrayBuffer is required). Open /workspace as a top-level tab over HTTPS or localhost. Browser Python (Pyodide) is unaffected.";

type OutputListener = (data: Uint8Array) => void;
export type LinuxRuntimePhase = "idle" | "booting" | "ready" | "running" | "error";
type PhaseListener = (phase: LinuxRuntimePhase) => void;

export type LinuxNetworkStatus =
    | "disconnected"
    | "connecting"
    | "login-required"
    | "connected"
    | "error";

export type LinuxNetworkSnapshot = {
    status: LinuxNetworkStatus;
    loginUrl: string | null;
    ip: string | null;
    hasExitNode: boolean;
    error: string | null;
};

let cheerpxModulePromise: Promise<CheerpXNamespace> | null = null;
let cloudDevicePromise: Promise<CheerpXDevice> | null = null;
let preferHttpDiskTransport = false;
let booted: { scopeId: string; cx: CheerpXLinux } | null = null;
let bootChain: Promise<unknown> = Promise.resolve();
let commandChain: Promise<unknown> = Promise.resolve();
let sendInput: ((keyCode: number) => void) | null = null;
let consoleCols = 80;
let consoleRows = 24;
let shellStarted = false;
let homeReady = false;
let liveProcess: Promise<{ status: number }> | null = null;
let failLiveProcess: ((error: Error) => void) | null = null;
let faultWatchInstalled = false;
let runtimePhase: LinuxRuntimePhase = "idle";
let overlayEpoch = 0;
let generationAbort: AbortController | null = null;
let bootFail: ((error: Error) => void) | null = null;
let consoleWatchInstalled = false;
let linuxUnavailableUntil = 0;
let lastLinuxFailure = "";
const outputListeners = new Set<OutputListener>();
const phaseListeners = new Set<PhaseListener>();
const networkListeners = new Set<(snapshot: LinuxNetworkSnapshot) => void>();
let hiddenConsole: HTMLPreElement | null = null;
let linuxNetwork: LinuxNetworkSnapshot = {
    status: "disconnected",
    loginUrl: null,
    ip: null,
    hasExitNode: false,
    error: null,
};
let networkLoginWindow: Window | null = null;

function setLinuxNetwork(patch: Partial<LinuxNetworkSnapshot>): void {
    linuxNetwork = { ...linuxNetwork, ...patch };
    for (const listener of networkListeners) listener(linuxNetwork);
}

export function getLinuxNetworkSnapshot(): LinuxNetworkSnapshot {
    return { ...linuxNetwork };
}

export function subscribeLinuxNetwork(
    listener: (snapshot: LinuxNetworkSnapshot) => void,
): () => void {
    networkListeners.add(listener);
    listener(linuxNetwork);
    return () => networkListeners.delete(listener);
}

const CHEERPX_NETWORK_INTERFACE: CheerpXNetworkInterface = {
    loginUrlCb: (url) => {
        setLinuxNetwork({ status: "login-required", loginUrl: url, error: null });
        if (networkLoginWindow && !networkLoginWindow.closed) {
            try {
                networkLoginWindow.location.href = url;
            } catch {
                // The URL remains available through the settings link.
            }
            networkLoginWindow = null;
        }
    },
    stateUpdateCb: (state) => {
        if (state === 6) {
            setLinuxNetwork({
                status: "connected",
                loginUrl: null,
                error: null,
            });
        } else if (linuxNetwork.status !== "connected") {
            setLinuxNetwork({ status: "connecting", error: null });
        }
    },
    netmapUpdateCb: (map) => {
        if (!map || typeof map !== "object") return;
        const value = map as {
            self?: { addresses?: unknown };
            peers?: unknown;
        };
        const addresses = value.self?.addresses;
        const ip = Array.isArray(addresses) && typeof addresses[0] === "string"
            ? addresses[0]
            : null;
        const hasExitNode = Array.isArray(value.peers) && value.peers.some(
            (peer) =>
                Boolean(
                    peer &&
                        typeof peer === "object" &&
                        (peer as { exitNode?: unknown }).exitNode === true,
                ),
        );
        setLinuxNetwork({ ip, hasExitNode });
    },
};

function markUnavailable(): void {
    if (typeof window !== "undefined") {
        (window as CheerpXWindow).CheerpXUnavailable = true;
    }
}

export function cheerpxAvailable(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as CheerpXWindow;
    return window.crossOriginIsolated === true && w.CheerpXUnavailable !== true;
}

export function linuxRuntimePhase(): LinuxRuntimePhase {
    return runtimePhase;
}

export function subscribeLinuxRuntime(listener: PhaseListener): () => void {
    phaseListeners.add(listener);
    listener(runtimePhase);
    return () => {
        phaseListeners.delete(listener);
    };
}

function setRuntimePhase(phase: LinuxRuntimePhase): void {
    if (runtimePhase === phase) return;
    runtimePhase = phase;
    for (const listener of phaseListeners) listener(phase);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function withDeadline<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
    signal?: AbortSignal,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error("Stopped by user."));
            return;
        }
        const timeoutId = window.setTimeout(() => {
            reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`));
        }, ms);
        const onAbort = () => {
            window.clearTimeout(timeoutId);
            reject(new Error("Stopped by user."));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        promise.then(
            (value) => {
                window.clearTimeout(timeoutId);
                signal?.removeEventListener("abort", onAbort);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timeoutId);
                signal?.removeEventListener("abort", onAbort);
                reject(error);
            },
        );
    });
}

function resetRuntime(): void {
    booted = null;
    shellStarted = false;
    homeReady = false;
    sendInput = null;
    liveProcess = null;
    failLiveProcess = null;
    if (runtimePhase !== "error") setRuntimePhase("idle");
}

function isStoppedError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return (
        (error instanceof DOMException && error.name === "AbortError") ||
        /stopped by user/i.test(message)
    );
}

function isCorruptImageError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return /invalid disk image|could not mount|disk failed to mount|initialization failed/i.test(
        message,
    );
}

function throwIfStopped(): void {
    if (generationAbort?.signal.aborted) {
        throw new Error("Stopped by user.");
    }
}

function overlayDbName(scopeId?: string): string {
    const scoped = `${OVERLAY_DB_BASE}-${sanitizeScopeId(scopeId || "draft")}`;
    return overlayEpoch > 0 ? `${scoped}-${overlayEpoch}` : scoped;
}

function deleteIndexedDb(name: string): Promise<void> {
    if (typeof indexedDB === "undefined") return Promise.resolve();
    return new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        const done = () => resolve();
        request.onsuccess = done;
        request.onerror = done;
        request.onblocked = done;
        window.setTimeout(done, 1_500);
    });
}

async function wipeOverlay(scopeId: string): Promise<void> {
    await deleteIndexedDb(overlayDbName(scopeId));
}

/** Abort a boot or command so Stop works while "Waiting for Linux VM…". */
export function abortLinuxExecution(): void {
    generationAbort?.abort();
    interruptRunningProcess();
    failCurrentProcess(new Error("Stopped by user."));
}

export function linuxGenerationAborted(): boolean {
    return generationAbort?.signal.aborted === true;
}

function failCurrentProcess(error: Error): void {
    failLiveProcess?.(error);
}

function failBoot(error: Error): void {
    bootFail?.(error);
    failCurrentProcess(error);
}

function installConsoleWatch(): void {
    if (typeof console === "undefined" || consoleWatchInstalled) return;
    consoleWatchInstalled = true;
    const original = console.error.bind(console);
    console.error = (...args: unknown[]) => {
        original(...args);
        const text = args
            .map((value) =>
                value instanceof Error ? value.message : String(value ?? ""),
            )
            .join(" ");
        if (
            /invalid disk image|could not mount|disk failed to mount|initialization failed|access-control-allow-origin|failed to load resource/i.test(
                text,
            )
        ) {
            failBoot(new Error("Linux disk failed to mount."));
        }
    };
}

function installFaultWatch(): void {
    if (typeof window === "undefined" || faultWatchInstalled) return;
    faultWatchInstalled = true;
    const onFault = (message: string): boolean => {
        if (
            !/cx\.esm|cheerpx|[ij]\[.+\].*is not a function|Fault addr|could not mount|invalid disk image|initialization failed/i.test(
                message,
            )
        ) {
            return false;
        }
        failBoot(new Error("Linux VM crashed. Retry the command."));
        resetRuntime();
        setRuntimePhase("error");
        return true;
    };
    window.addEventListener("error", (event) => {
        if (onFault(`${event.filename ?? ""} ${event.message ?? ""}`)) {
            event.preventDefault();
        }
    });
    window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        if (onFault(reason instanceof Error ? reason.message : String(reason ?? ""))) {
            event.preventDefault();
        }
    });
}

export function isLinuxClientTool(name: string): name is LinuxToolName {
    return (
        name === "run_command" ||
        name === "read_file" ||
        name === "linux_run_command" ||
        name === "linux_read_file" ||
        name === "linux_background_start" ||
        name === "linux_list_processes" ||
        name === "linux_kill_process"
    );
}

function linuxToolKind(name: LinuxToolName): "run_command" | "read_file" {
    return name === "read_file" || name === "linux_read_file"
        ? "read_file"
        : "run_command";
}

function isBackgroundTool(name: LinuxToolName): boolean {
    return (
        name === "linux_background_start" ||
        name === "linux_list_processes" ||
        name === "linux_kill_process"
    );
}

function sanitizeScopeId(scopeId: string): string {
    const cleaned = scopeId.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    return cleaned || "draft";
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return out;
}

function decodeBytes(chunks: Uint8Array[]): string {
    try {
        return new TextDecoder("utf-8", { fatal: false }).decode(concatBytes(chunks));
    } catch {
        return "";
    }
}

function capOutput(text: string): string {
    if (text.length <= MAX_OUTPUT_BYTES) return text;
    return `${text.slice(0, MAX_OUTPUT_BYTES)}\n[truncated: output exceeded 32KB]`;
}

function emitOutput(buf: Uint8Array): void {
    const data = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (data.byteLength === 0) return;
    for (const listener of outputListeners) listener(data);
}

export function subscribeCheerpXOutput(listener: OutputListener): () => void {
    outputListeners.add(listener);
    return () => {
        outputListeners.delete(listener);
    };
}

export function sendCheerpXKey(keyCode: number): void {
    sendInput?.(keyCode);
}

export function sendCheerpXText(text: string): void {
    for (let i = 0; i < text.length; i += 1) {
        sendInput?.(text.charCodeAt(i));
    }
}

function installConsole(cx: CheerpXLinux, cols: number, rows: number): void {
    consoleCols = Math.max(20, cols);
    consoleRows = Math.max(8, rows);
    if (typeof cx.setCustomConsole === "function") {
        sendInput = cx.setCustomConsole(
            (buf) => emitOutput(buf),
            consoleCols,
            consoleRows,
        );
        return;
    }
    if (typeof document === "undefined") return;
    if (!hiddenConsole) {
        hiddenConsole = document.createElement("pre");
        hiddenConsole.dataset.aidiyCheerpxConsole = "true";
        hiddenConsole.setAttribute("aria-hidden", "true");
        hiddenConsole.style.cssText =
            "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
        document.body.appendChild(hiddenConsole);
        const observer = new MutationObserver(() => {
            const text = hiddenConsole?.textContent ?? "";
            hiddenConsole?.replaceChildren();
            if (text) emitOutput(new TextEncoder().encode(text));
        });
        observer.observe(hiddenConsole, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }
    cx.setConsole(hiddenConsole);
}

export function resizeCheerpXConsole(cols: number, rows: number): void {
    if (!booted?.cx) return;
    if (cols === consoleCols && rows === consoleRows) return;
    installConsole(booted.cx, cols, rows);
}

async function loadCheerpX(): Promise<CheerpXNamespace> {
    if (cheerpxModulePromise) return cheerpxModulePromise;
    cheerpxModulePromise = (async () => {
        try {
            const mod = (await import(
                /* @vite-ignore */ CHEERPX_LOADER_URL
            )) as CheerpXNamespace;
            if (!mod?.Linux?.create || !mod.CloudDevice || !mod.IDBDevice || !mod.OverlayDevice) {
                throw new Error("CheerpX loader is missing Linux or device APIs.");
            }
            return mod;
        } catch (error) {
            cheerpxModulePromise = null;
            markUnavailable();
            throw error;
        }
    })();
    return cheerpxModulePromise;
}

async function createBaseDevice(CX: CheerpXNamespace): Promise<CheerpXDevice> {
    const primaryUrl = preferHttpDiskTransport
        ? CHEERPX_DISK_IMAGE_HTTP_URL
        : CHEERPX_DISK_IMAGE_URL;
    try {
        return await CX.CloudDevice.create(primaryUrl);
    } catch (primaryError) {
        if (primaryUrl === CHEERPX_DISK_IMAGE_HTTP_URL) throw primaryError;
        preferHttpDiskTransport = true;
        try {
            return await CX.CloudDevice.create(CHEERPX_DISK_IMAGE_HTTP_URL);
        } catch (fallbackError) {
            throw new AggregateError(
                [primaryError, fallbackError],
                "Linux disk transport failed over WebSocket and HTTPS.",
            );
        }
    }
}

async function getBaseDevice(CX: CheerpXNamespace): Promise<CheerpXDevice> {
    if (!cloudDevicePromise) {
        cloudDevicePromise = createBaseDevice(CX).catch((error) => {
            cloudDevicePromise = null;
            throw error;
        });
    }
    return cloudDevicePromise;
}

async function createLinux(scopeId: string): Promise<CheerpXLinux> {
    const CX = await loadCheerpX();
    const baseDevice = await getBaseDevice(CX);
    const idbDevice = await CX.IDBDevice.create(overlayDbName(scopeId));
    const overlayDevice = await CX.OverlayDevice.create(baseDevice, idbDevice);
    return new Promise<CheerpXLinux>((resolve, reject) => {
        const rejectBoot = (error: Error) => reject(error);
        bootFail = rejectBoot;
        void CX.Linux.create({
            mounts: [
                { type: "ext2", path: "/", dev: overlayDevice },
                { type: "devs", path: "/dev" },
                { type: "devpts", path: "/dev/pts" },
                { type: "proc", path: "/proc" },
            ],
            networkInterface: CHEERPX_NETWORK_INTERFACE,
        }).then(resolve, reject).finally(() => {
            if (bootFail === rejectBoot) bootFail = null;
        });
    });
}

async function recoverOverlay(scopeId: string): Promise<void> {
    const stale = overlayDbName(scopeId);
    overlayEpoch += 1;
    await deleteIndexedDb(stale).catch(() => undefined);
    resetRuntime();
}

async function bootCheerpXInner(scopeId: string): Promise<CheerpXLinux> {
    installFaultWatch();
    installConsoleWatch();
    if (!cheerpxAvailable()) {
        throw new Error(UNAVAILABLE_MESSAGE);
    }
    if (booted && booted.scopeId !== scopeId) {
        const previous = booted;
        await stopInteractiveShell();
        killUserProcesses(previous.cx);
        resetRuntime();
    }
    if (booted) return booted.cx;
    setRuntimePhase("booting");
    const bootOnce = () =>
        withDeadline(
            createLinux(scopeId),
            BOOT_TIMEOUT_MS,
            "Linux VM boot",
            generationAbort?.signal,
        );
    try {
        throwIfStopped();
        let cx: CheerpXLinux;
        try {
            cx = await bootOnce();
        } catch (error) {
            if (isStoppedError(error)) throw error;
            if (isCorruptImageError(error)) {
                preferHttpDiskTransport = true;
                cloudDevicePromise = null;
            }
            await recoverOverlay(scopeId);
            setRuntimePhase("booting");
            cx = await bootOnce();
        }
        throwIfStopped();
        booted = { scopeId, cx };
        shellStarted = false;
        homeReady = false;
        installConsole(cx, consoleCols, consoleRows);
        setRuntimePhase("ready");
        return cx;
    } catch (error) {
        if (!isStoppedError(error)) {
            await recoverOverlay(scopeId).catch(() => undefined);
            setRuntimePhase("error");
        }
        throw error;
    }
}

export function bootCheerpX(scopeId: string): Promise<CheerpXLinux> {
    const next = bootChain.then(
        () => bootCheerpXInner(scopeId),
        () => bootCheerpXInner(scopeId),
    );
    bootChain = next.then(
        () => undefined,
        () => undefined,
    );
    return next;
}

export function bootedCheerpXScope(): string | null {
    return booted?.scopeId ?? null;
}

/** Start the interactive Tailscale login flow for the already-warm VM. */
export async function connectLinuxNetwork(
    scopeId: string,
): Promise<LinuxNetworkSnapshot> {
    if (!cheerpxAvailable()) {
        setLinuxNetwork({
            status: "error",
            error: "The page is not cross-origin isolated, so CheerpX networking cannot start.",
        });
        return getLinuxNetworkSnapshot();
    }

    // Reserve a user-gesture-created window before the VM/network promises run.
    // Tailscale may deliver its login URL asynchronously after networkLogin().
    if (typeof window !== "undefined") {
        networkLoginWindow = window.open("about:blank", "_blank");
    }
    if (!generationAbort || generationAbort.signal.aborted) {
        generationAbort = new AbortController();
    }
    setLinuxNetwork({ status: "connecting", loginUrl: null, error: null });

    try {
        const cx = await bootCheerpX(scopeId);
        if (typeof cx.networkLogin !== "function") {
            throw new Error("This CheerpX build does not expose network login.");
        }
        // Do not hold the command lock while Tailscale waits for browser login.
        void Promise.resolve(cx.networkLogin()).catch((error) => {
            setLinuxNetwork({
                status: "error",
                error: error instanceof Error ? error.message : String(error),
            });
        });
    } catch (error) {
        networkLoginWindow?.close();
        networkLoginWindow = null;
        setLinuxNetwork({
            status: "error",
            error: error instanceof Error ? error.message : String(error),
        });
    }
    return getLinuxNetworkSnapshot();
}

export function openLinuxNetworkLogin(): void {
    const url = linuxNetwork.loginUrl;
    if (!url || typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
}

async function stopInteractiveShell(): Promise<void> {
    if (!shellStarted) return;
    sendCheerpXText("exit\n");
    sendCheerpXKey(4);
    if (liveProcess) {
        await Promise.race([
            liveProcess.catch(() => undefined),
            delay(SHELL_EXIT_GRACE_MS),
        ]);
    }
    shellStarted = false;
}

export async function ensureInteractiveShell(scopeId: string): Promise<void> {
    const cx = await bootCheerpX(scopeId);
    await ensureWritableHome(cx);
    if (shellStarted || liveProcess) return;
    shellStarted = true;
    const run = cx.run("/bin/bash", ["--login"], {
        env: DEFAULT_ENV,
        cwd: DEFAULT_CWD,
        uid: 1000,
        gid: 1000,
    });
    liveProcess = run;
    void run.finally(() => {
        if (liveProcess === run) liveProcess = null;
        if (booted?.cx === cx) shellStarted = false;
    });
}

function withCommandLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = commandChain.then(fn, fn);
    commandChain = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

function interruptRunningProcess(): void {
    sendCheerpXKey(3);
    sendCheerpXKey(3);
    sendCheerpXKey(28);
}

async function runProcess(
    cx: CheerpXLinux,
    args: string[],
    cwd: string,
    opts?: {
        uid?: number;
        gid?: number;
        timeoutMs?: number;
        maxOutputBytes?: number;
        /** Prepend a pid-emission echo and parse AIDIY_PID from the output. */
        trackPid?: boolean;
    },
): Promise<{
    status: number;
    timedOut: boolean;
    output: string;
    pid?: number;
    durationMs: number;
}> {
    await stopInteractiveShell();
    const chunks: Uint8Array[] = [];
    const maxOutputBytes = opts?.maxOutputBytes;
    let capturedOutputBytes = 0;
    let outputTruncated = false;
    const unsubscribe = subscribeCheerpXOutput((buf) => {
        if (!maxOutputBytes || capturedOutputBytes < maxOutputBytes) {
            const remaining = maxOutputBytes
                ? maxOutputBytes - capturedOutputBytes
                : buf.byteLength;
            const chunk = buf.byteLength > remaining ? buf.slice(0, remaining) : buf;
            chunks.push(chunk);
            capturedOutputBytes += chunk.byteLength;
            if (chunk.byteLength < buf.byteLength) outputTruncated = true;
        } else {
            outputTruncated = true;
        }
    });
    let timedOut = false;
    const timeoutMs = opts?.timeoutMs ?? COMMAND_TIMEOUT_MS;
    const startedAt = Date.now();
    setRuntimePhase("running");
    const fullArgs = opts?.trackPid ? ["-lc", `echo AIDIY_PID:$$; ${args[1] ?? ""}`] : args;
    try {
        const result = await new Promise<{ status: number }>((resolve, reject) => {
            failLiveProcess = reject;
            const timeoutId = window.setTimeout(() => {
                timedOut = true;
                // Phase 1: graceful interrupt (SIGINT/SIGQUIT) so quick
                // processes exit cleanly.
                interruptRunningProcess();
                // Phase 2: escalate — SIGKILL every user process (the hung
                // command and all its descendants). CheerpX is multi-process,
                // so this runs in parallel and does not wait on the hung run.
                window.setTimeout(() => killUserProcesses(cx), 400);
                reject(new Error("timeout"));
            }, timeoutMs);
            const run = cx.run("/bin/bash", fullArgs, {
                env: DEFAULT_ENV,
                cwd,
                uid: opts?.uid ?? 1000,
                gid: opts?.gid ?? 1000,
            });
            liveProcess = run;
            void run.then(resolve, reject).finally(() => {
                window.clearTimeout(timeoutId);
                if (liveProcess === run) liveProcess = null;
                if (failLiveProcess === reject) failLiveProcess = null;
            });
        });
        const output = decodeBytes(chunks) + (outputTruncated ? "\n[output truncated]" : "");
        const sentinelTimeout = /AIDIY_TIMEOUT/.test(output);
        return {
            status: result.status,
            timedOut: timedOut || sentinelTimeout || result.status === 124,
            output,
            pid: parsePidSentinel(output),
            durationMs: Date.now() - startedAt,
        };
    } catch (error) {
        const output = decodeBytes(chunks) + (outputTruncated ? "\n[output truncated]" : "");
        if (isStoppedError(error)) {
            return { status: 130, timedOut: false, output, durationMs: Date.now() - startedAt };
        }
        if (timedOut || (error instanceof Error && /timed out/i.test(error.message))) {
            return {
                status: 124,
                timedOut: true,
                output,
                pid: parsePidSentinel(output),
                durationMs: Date.now() - startedAt,
            };
        }
        resetRuntime();
        throw error;
    } finally {
        unsubscribe();
        if (booted) setRuntimePhase("ready");
    }
}

/**
 * SIGKILL all uid-1000 processes in the VM. Commands are serialized through
 * the command chain and the interactive shell is stopped first, so the only
 * user-owned processes at timeout time belong to the hung command tree.
 * Never matches root: killing init would take the whole VM down.
 */
function killUserProcesses(cx: CheerpXLinux): void {
    void cx
        .run(
            "/bin/bash",
            ["-lc", "pkill -9 -u 1000 2>/dev/null; exit 0"],
            { env: DEFAULT_ENV, cwd: "/", uid: 1000, gid: 1000 },
        )
        .catch(() => undefined);
}

function parsePidSentinel(output: string): number | undefined {
    const match = /AIDIY_PID:(\d+)/.exec(output);
    const pid = match?.[1] ? Number.parseInt(match[1], 10) : NaN;
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

async function ensureWritableHome(cx: CheerpXLinux): Promise<void> {
    if (homeReady) return;
    // WebVM's image already contains /home/user and /tmp. Mutating permissions
    // here used to launch chmod as root before every first command; on some
    // CheerpX builds that faulted and left the chat waiting forever.
    void cx;
    homeReady = true;
}

/**
 * One-time per-page probe. If the image has npm's CLI but no frontend, install
 * a small local wrapper into /home/user/bin. No network bootstrap is attempted.
 */
let toolchainEnsure: Promise<void> | null = null;
let toolchainNote: string | null = null;

const TOOLCHAIN_PROBE = `set +e
for t in node npm python3 pip3 gcc g++ make git curl wget jq; do
  p=$(command -v "$t" 2>/dev/null)
  if [ -n "$p" ]; then echo "HAVE $t=$p"; else echo "MISSING $t"; fi
done
if command -v npm >/dev/null 2>&1; then
  echo NPM_READY
elif [ -f /usr/share/nodejs/npm/bin/npm-cli.js ]; then
  if [ ! -x "$HOME/bin/npm" ]; then
    mkdir -p "$HOME/bin"
    printf '%s\n' '#!/bin/bash' 'export NODE_PATH="/usr/share/nodejs"' 'exec node /usr/share/nodejs/npm/bin/npm-cli.js "$@"' > "$HOME/bin/npm"
    chmod +x "$HOME/bin/npm"
    echo NPM_WRAPPER_INSTALLED
  else
    echo NPM_WRAPPER_PRESENT
  fi
  echo NPM_READY
else
  echo NPM_CLI_MISSING
fi`;

async function probeToolchain(cx: CheerpXLinux): Promise<void> {
    const result = await runProcess(cx, ["-lc", TOOLCHAIN_PROBE], DEFAULT_CWD, {
        timeoutMs: 20_000,
    });
    toolchainNote = result.output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && /^(HAVE|MISSING|NPM_)/.test(line))
        .join("; ");
    console.info("[cheerpx] toolchain:", toolchainNote);
}

function ensureToolchain(cx: CheerpXLinux): Promise<void> {
    if (!toolchainEnsure) {
        const attempt = probeToolchain(cx).catch(() => undefined);
        toolchainEnsure = attempt;
        void attempt.finally(() => {
            if (toolchainEnsure === attempt && !/NPM_READY/.test(toolchainNote ?? "")) {
                // Retry after the user connects Tailscale with an exit node.
                toolchainEnsure = null;
            }
        });
    }
    return toolchainEnsure;
}

export function getToolchainNote(): string | null {
    return toolchainNote;
}

function resolveCommandTimeoutMs(timeoutSec?: number): number {
    const requestedMs = Math.round(Number(timeoutSec) * 1000);
    return Number.isFinite(requestedMs) && requestedMs > 0
        ? Math.min(MAX_COMMAND_TIMEOUT_MS, requestedMs)
        : COMMAND_TIMEOUT_MS;
}

function commandNeedsNpm(source: string): boolean {
    return /(?:^|\n)\s*(?:exec\s+)?npm(?:\s|$)/.test(source);
}

export async function runCommand(
    cx: CheerpXLinux,
    command: string,
    opts?: { cwd?: string; timeoutSec?: number },
): Promise<LinuxCommandResult> {
    const source = String(command ?? "").trim();
    if (!source) {
        return { stdout: "", stderr: "No command provided.", exitCode: 1, timedOut: false };
    }
    const cwd = String(opts?.cwd ?? DEFAULT_CWD).trim() || DEFAULT_CWD;
    if (commandNeedsNpm(source)) {
        await ensureToolchain(cx);
        const note = toolchainNote ?? "";
        if (/NPM_CLI_MISSING/.test(note)) {
            // Missing executables can destabilize this CheerpX image. Do not
            // launch npm until the toolchain probe has installed a wrapper.
            return {
                stdout: "",
                stderr: note || "NPM_CLI_MISSING",
                exitCode: 127,
                timedOut: false,
                durationMs: 0,
            };
        }
    }
    const timeoutMs = resolveCommandTimeoutMs(opts?.timeoutSec);
    const timeoutSec = Math.round(timeoutMs / 1000);
    await ensureWritableHome(cx);
    const result = await runProcess(
        cx,
        ["-lc", source],
        cwd,
        { timeoutMs, maxOutputBytes: MAX_OUTPUT_BYTES },
    );
    const stdout = capOutput(
        result.output.replace(/\n?AIDIY_PID:\d+\n?/g, "").replace(/\n?AIDIY_TIMEOUT\n?/g, "").trimEnd(),
    );
    return {
        stdout,
        stderr: result.timedOut
            ? `Command timed out after ${timeoutSec}s; all descendant processes were killed.`
            : result.status === 130
              ? "Stopped by user."
              : "",
        exitCode: result.timedOut ? 124 : result.status,
        timedOut: result.timedOut,
        pid: result.pid,
        durationMs: result.durationMs,
    };
}

const READ_WRAPPER = `path="$1"
max="$2"
if [ ! -e "$path" ]; then
  echo AIDIY_ERR:not_found >&2
  exit 2
fi
if [ -d "$path" ]; then
  echo AIDIY_ERR:is_directory >&2
  exit 2
fi
size=$(wc -c < "$path" | tr -d " ")
if [ "$size" -gt "$max" ]; then
  echo AIDIY_ERR:too_large:$size >&2
  exit 3
fi
echo AIDIY_B64_BEGIN
python3 -c 'import base64,sys; print(base64.b64encode(open(sys.argv[1], "rb").read()).decode())' "$path"
echo AIDIY_B64_END`;

function looksLikeText(bytes: Uint8Array): boolean {
    const sample = bytes.subarray(0, Math.min(bytes.length, 1024));
    let odd = 0;
    for (const value of sample) {
        if (value === 0) return false;
        if (value < 9 || (value > 13 && value < 32)) odd += 1;
    }
    return odd / Math.max(sample.length, 1) < 0.1;
}

export async function readFileFromVM(
    cx: CheerpXLinux,
    path: string,
    maxBytes: number = MAX_FILE_BYTES,
): Promise<LinuxClientResult> {
    const target = String(path ?? "").trim();
    if (!target) {
        return { output: "read_file error: no path provided.", artifacts: [] };
    }
    const cap = Math.min(Math.max(1, maxBytes), MAX_FILE_BYTES);
    const result = await runProcess(
        cx,
        ["-lc", READ_WRAPPER, "aidiy-read", target, String(cap)],
        DEFAULT_CWD,
    );
    const text = result.output;
    if (/AIDIY_ERR:not_found/.test(text)) {
        return { output: `read_file error: ${target} does not exist.`, artifacts: [] };
    }
    if (/AIDIY_ERR:is_directory/.test(text)) {
        return { output: `read_file error: ${target} is a directory.`, artifacts: [] };
    }
    const tooLarge = text.match(/AIDIY_ERR:too_large:(\d+)/);
    if (tooLarge) {
        return {
            output: `read_file error: ${target} is ${tooLarge[1]} bytes (limit ${cap} bytes / 2 MiB).`,
            artifacts: [],
        };
    }
    const begin = text.indexOf("AIDIY_B64_BEGIN");
    const end = text.indexOf("AIDIY_B64_END");
    if (begin < 0 || end < 0 || end <= begin) {
        return {
            output: capOutput(
                `read_file error: could not capture ${target}.\n${text}`.trim(),
            ),
            artifacts: [],
        };
    }
    const b64 = text
        .slice(begin + "AIDIY_B64_BEGIN".length, end)
        .replace(/\s+/g, "");
    if (!b64) {
        return { output: `read_file: ${target} is empty.`, artifacts: [] };
    }
    let bytes: Uint8Array;
    try {
        const binary = atob(b64);
        bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    } catch {
        return { output: `read_file error: invalid Base64 payload for ${target}.`, artifacts: [] };
    }
    const filename = target.split("/").filter(Boolean).pop() || "file";
    const artifact: LinuxArtifact = {
        filename: filename.replace(/[\\/]/g, "_"),
        content: b64,
        contentEncoding: "base64",
    };
    const preview = looksLikeText(bytes)
        ? new TextDecoder("utf-8", { fatal: false })
              .decode(bytes)
              .slice(0, 8_000)
        : "";
    const summary = preview
        ? `Read ${target} (${bytes.byteLength} bytes). Canvas artifact: \`${artifact.filename}\`.\n\n${preview}`
        : `Read ${target} (${bytes.byteLength} bytes, binary). Canvas artifact: \`${artifact.filename}\`.`;
    return { output: capOutput(summary), artifacts: [artifact] };
}

const BG_DIR = "/home/user/.aidiy-bg";

/**
 * Background-process primitive: `setsid bash <script> &` so the process
 * survives the launching command and gets its own process group. The pid
 * returned is the group leader — linux_kill_process kills the whole group.
 */
async function startBackgroundProcess(
    cx: CheerpXLinux,
    command: string,
    cwd: string,
): Promise<LinuxClientResult> {
    const source = String(command ?? "").trim();
    if (!source) {
        return {
            output: "linux_background_start error: no command provided.",
            artifacts: [],
        };
    }
    const workDir = String(cwd ?? "").trim() || DEFAULT_CWD;
    const script = [
        "set -u",
        `workdir="${workDir}"`,
        'cd "$workdir" || exit 9',
        `mkdir -p ${BG_DIR}`,
        `cat > ${BG_DIR}/cmd.sh <<'AIDIY_EOF'`,
        source,
        "AIDIY_EOF",
        `setsid bash ${BG_DIR}/cmd.sh > ${BG_DIR}/out.log 2>&1 < /dev/null &`,
        "echo AIDIY_PID:$!",
    ].join("\n");
    const result = await runProcess(cx, ["-lc", script], DEFAULT_CWD, {
        timeoutMs: 20_000,
    });
    const pid = parsePidSentinel(result.output);
    if (result.timedOut || pid == null) {
        return {
            output: `linux_background_start error: could not start the background process (timedOut: ${result.timedOut}).`,
            artifacts: [],
        };
    }
    return {
        output: `Background process started.\npid: ${pid}\nlog: ${BG_DIR}/out.log\n\nVerify readiness with linux_list_processes and by reading the log; stop it with linux_kill_process(${pid}).`,
        artifacts: [],
    };
}

async function listProcesses(cx: CheerpXLinux): Promise<LinuxClientResult> {
    const result = await runProcess(
        cx,
        ["-lc", "ps -u 1000 -o pid=,stat=,etime=,args= --sort=pid"],
        DEFAULT_CWD,
        { timeoutMs: 20_000 },
    );
    if (result.timedOut) {
        return {
            output: "linux_list_processes: timed out listing processes.",
            artifacts: [],
        };
    }
    const lines = result.output.trim();
    return {
        output: capOutput(
            lines
                ? `User processes (uid 1000):\n${lines}`
                : "No user processes are running.",
        ),
        artifacts: [],
    };
}

async function killProcess(
    cx: CheerpXLinux,
    pidRaw: unknown,
): Promise<LinuxClientResult> {
    const pid = Number(pidRaw);
    if (!Number.isInteger(pid) || pid <= 0) {
        return {
            output: "linux_kill_process error: a positive numeric pid is required.",
            artifacts: [],
        };
    }
    const script = [
        `if ! kill -0 ${pid} 2>/dev/null; then`,
        "  echo AIDIY_ERR:no_such_pid >&2",
        "  exit 4",
        "fi",
        `kill -9 -- -${pid} 2>/dev/null`,
        `pkill -9 -P ${pid} 2>/dev/null`,
        `kill -9 ${pid} 2>/dev/null`,
        `echo AIDIY_KILLED:${pid}`,
    ].join("\n");
    const result = await runProcess(cx, ["-lc", script], DEFAULT_CWD, {
        timeoutMs: 20_000,
    });
    const text = result.output;
    if (/AIDIY_ERR:no_such_pid/.test(text)) {
        return {
            output: `linux_kill_process: process ${pid} is not running.`,
            artifacts: [],
        };
    }
    return {
        output: /AIDIY_KILLED:/.test(text)
            ? `Process ${pid} and its descendants were killed.`
            : `linux_kill_process: could not confirm the kill of ${pid}.\n${capOutput(text)}`,
        artifacts: [],
    };
}

function formatCommandOutput(result: LinuxCommandResult): string {
    const parts = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exitCode: ${result.exitCode}`,
        result.timedOut ? "timedOut: true" : "",
        result.pid != null ? `pid: ${result.pid}` : "",
        result.durationMs != null ? `durationMs: ${result.durationMs}` : "",
    ].filter(Boolean);
    return capOutput(parts.join("\n\n") || "Command completed with no output.");
}

export function prefetchCheerpX(): void {
    if (typeof window === "undefined" || !cheerpxAvailable()) return;
    void loadCheerpX()
        .then((CX) => getBaseDevice(CX))
        .catch(() => undefined);
}

export async function prewarmCheerpX(scopeId: string): Promise<void> {
    prefetchCheerpX();
    if (!cheerpxAvailable()) return;
    if (!generationAbort || generationAbort.signal.aborted) {
        generationAbort = new AbortController();
    }
    await withCommandLock(async () => {
        if (linuxGenerationAborted()) return;
        const cx = await bootCheerpX(scopeId);
        await ensureWritableHome(cx);
    });
}

export async function executeLinuxClientTool(
    name: LinuxToolName,
    input: {
        command?: string;
        cwd?: string;
        path?: string;
        maxBytes?: number;
        pid?: number;
        timeoutSec?: number;
    },
    scopeId: string,
): Promise<LinuxClientResult> {
    if (!cheerpxAvailable()) {
        return { output: UNAVAILABLE_MESSAGE, artifacts: [] };
    }
    if (Date.now() < linuxUnavailableUntil) {
        return {
            output: `Linux environment is temporarily unavailable after a VM failure: ${lastLinuxFailure || "startup failed"}. Do not retry Linux tools in this turn; use browser Python or answer without execution.`,
            artifacts: [],
        };
    }
    generationAbort = new AbortController();
    return withCommandLock(async () => {
        try {
            throwIfStopped();
            return await withDeadline(
                (async () => {
                    const cx = await bootCheerpX(scopeId);
                    throwIfStopped();
                    await ensureWritableHome(cx);
                    throwIfStopped();
                    if (linuxToolKind(name) === "read_file") {
                        return readFileFromVM(cx, input.path ?? "", input.maxBytes);
                    }
                    if (isBackgroundTool(name)) {
                        if (name === "linux_background_start") {
                            if (commandNeedsNpm(input.command ?? "")) {
                                await ensureToolchain(cx);
                                throwIfStopped();
                            }
                            return startBackgroundProcess(
                                cx,
                                input.command ?? "",
                                input.cwd ?? "",
                            );
                        }
                        if (name === "linux_list_processes") {
                            return listProcesses(cx);
                        }
                        return killProcess(cx, input.pid);
                    }
                    const result = await runCommand(cx, input.command ?? "", {
                        cwd: input.cwd,
                        timeoutSec: input.timeoutSec,
                    });
                    if (result.exitCode === 130) {
                        return { output: "Stopped by user.", artifacts: [] };
                    }
                    linuxUnavailableUntil = 0;
                    lastLinuxFailure = "";
                    return { output: formatCommandOutput(result), artifacts: [] };
                })(),
                BOOT_TIMEOUT_MS + resolveCommandTimeoutMs(input.timeoutSec) + 5_000,
                "Linux environment",
                generationAbort?.signal,
            );
        } catch (error) {
            if (isStoppedError(error)) {
                return { output: "Stopped by user.", artifacts: [] };
            }
            const reason = error instanceof Error ? error.message : String(error);
            if (isCorruptImageError(error)) {
                await wipeOverlay(scopeId).catch(() => undefined);
            }
            linuxUnavailableUntil = Date.now() + LINUX_FAILURE_COOLDOWN_MS;
            lastLinuxFailure = reason.slice(0, 240);
            resetRuntime();
            setRuntimePhase("error");
            return {
                output: `Linux environment error: ${reason.slice(0, 800)}\n\nDo not retry Linux tools in this turn. The VM is cooling down; use browser Python or continue without execution.`,
                artifacts: [],
            };
        }
    });
}
