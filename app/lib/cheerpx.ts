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
};

export type LinuxClientResult = {
    output: string;
    artifacts: LinuxArtifact[];
};

export type LinuxToolName =
    | "run_command"
    | "read_file"
    | "linux_run_command"
    | "linux_read_file";

type CheerpXDevice = {
    readFileAsBlob?: (path: string) => Promise<Blob>;
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
};

type CheerpXNamespace = {
    Linux: {
        create: (options: {
            mounts: Array<{ type: string; path: string; dev?: CheerpXDevice }>;
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

/** Latest 1.x on the Leaning CDN (npm `cheerpx@1.3.7`, 2026-07-30). Docs examples still show 1.2.8; majors are the compatibility boundary. */
export const CHEERPX_VERSION = "1.3.7";
export const CHEERPX_LOADER_URL = `https://cxrtnc.leaningtech.com/${CHEERPX_VERSION}/cx.esm.js`;
/** Official WebVM debian_large image from CheerpX getting-started + webvm README. */
export const CHEERPX_DISK_IMAGE_URL =
    "wss://disks.webvm.io/debian_large_20230522_5044875331.ext2";

const COMMAND_TIMEOUT_MS = 90_000;
const COMMAND_TIMEOUT_SEC = 90;
const BOOT_TIMEOUT_MS = 120_000;
const HOME_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_BYTES = 32 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_CWD = "/home/user";

const DEFAULT_ENV = [
    "HOME=/home/user",
    "USER=user",
    "SHELL=/bin/bash",
    "EDITOR=vi",
    "LANG=en_US.UTF-8",
    "LC_ALL=C",
    "TERM=xterm-256color",
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
];

const UNAVAILABLE_MESSAGE =
    "Linux environment is unavailable. This page is not cross-origin isolated (SharedArrayBuffer is required). Open /workspace as a top-level tab over HTTPS or localhost. Browser Python (Pyodide) is unaffected.";

type OutputListener = (data: Uint8Array) => void;
export type LinuxRuntimePhase = "idle" | "booting" | "ready" | "running" | "error";
type PhaseListener = (phase: LinuxRuntimePhase) => void;

let cheerpxModulePromise: Promise<CheerpXNamespace> | null = null;
let cloudDevicePromise: Promise<CheerpXDevice> | null = null;
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
const outputListeners = new Set<OutputListener>();
const phaseListeners = new Set<PhaseListener>();
let hiddenConsole: HTMLPreElement | null = null;

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
    return /invalid disk image|could not mount|initialization failed/i.test(
        message,
    );
}

function throwIfStopped(): void {
    if (generationAbort?.signal.aborted) {
        throw new Error("Stopped by user.");
    }
}

function overlayDbName(scopeId: string): string {
    const base = `aidiy-vm-${sanitizeScopeId(scopeId)}`;
    return overlayEpoch > 0 ? `${base}-${overlayEpoch}` : base;
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
    const name = overlayDbName(scopeId);
    await deleteIndexedDb(name);
    overlayEpoch += 1;
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

function installFaultWatch(): void {
    if (typeof window === "undefined" || faultWatchInstalled) return;
    faultWatchInstalled = true;
    const onFault = (message: string) => {
        if (
            !/cx\.esm|cheerpx|j\[.+\] is not a function|Fault addr/i.test(message)
        ) {
            return;
        }
        failCurrentProcess(
            new Error("Linux VM crashed. Retry with a simpler command."),
        );
        resetRuntime();
        setRuntimePhase("error");
    };
    window.addEventListener("error", (event) => {
        onFault(`${event.filename ?? ""} ${event.message ?? ""}`);
    });
    window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        onFault(reason instanceof Error ? reason.message : String(reason ?? ""));
    });
}

export function isLinuxClientTool(name: string): name is LinuxToolName {
    return (
        name === "run_command" ||
        name === "read_file" ||
        name === "linux_run_command" ||
        name === "linux_read_file"
    );
}

function linuxToolKind(name: LinuxToolName): "run_command" | "read_file" {
    return name === "read_file" || name === "linux_read_file"
        ? "read_file"
        : "run_command";
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
                /* @vite-ignore */ "https://cxrtnc.leaningtech.com/1.3.7/cx.esm.js"
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

async function getCloudDevice(CX: CheerpXNamespace): Promise<CheerpXDevice> {
    if (!cloudDevicePromise) {
        cloudDevicePromise = CX.CloudDevice.create(CHEERPX_DISK_IMAGE_URL).catch(
            (error) => {
                cloudDevicePromise = null;
                throw error;
            },
        );
    }
    return cloudDevicePromise;
}

async function createLinux(scopeId: string): Promise<CheerpXLinux> {
    const CX = await loadCheerpX();
    const cloudDevice = await getCloudDevice(CX);
    const idbDevice = await CX.IDBDevice.create(overlayDbName(scopeId));
    const overlayDevice = await CX.OverlayDevice.create(cloudDevice, idbDevice);
    return CX.Linux.create({
        mounts: [
            { type: "ext2", path: "/", dev: overlayDevice },
            { type: "devs", path: "/dev" },
            { type: "devpts", path: "/dev/pts" },
            { type: "proc", path: "/proc" },
        ],
    });
}

async function bootCheerpXInner(scopeId: string): Promise<CheerpXLinux> {
    installFaultWatch();
    if (!cheerpxAvailable()) {
        throw new Error(UNAVAILABLE_MESSAGE);
    }
    if (booted?.scopeId === scopeId) return booted.cx;
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
            if (error instanceof Error && /timed out/i.test(error.message)) {
                throw error;
            }
            await wipeOverlay(scopeId);
            resetRuntime();
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
            resetRuntime();
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

async function stopInteractiveShell(): Promise<void> {
    if (!shellStarted) return;
    sendCheerpXText("exit\n");
    sendCheerpXKey(4);
    if (liveProcess) {
        await Promise.race([liveProcess.catch(() => undefined), delay(1_500)]);
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
    opts?: { uid?: number; gid?: number; timeoutMs?: number },
): Promise<{ status: number; timedOut: boolean; output: string }> {
    await stopInteractiveShell();
    const chunks: Uint8Array[] = [];
    const unsubscribe = subscribeCheerpXOutput((buf) => {
        chunks.push(buf);
    });
    let timedOut = false;
    const timeoutMs = opts?.timeoutMs ?? COMMAND_TIMEOUT_MS;
    setRuntimePhase("running");
    try {
        const result = await new Promise<{ status: number }>((resolve, reject) => {
            failLiveProcess = reject;
            const timeoutId = window.setTimeout(() => {
                timedOut = true;
                interruptRunningProcess();
                reject(new Error("timeout"));
            }, timeoutMs);
            const run = cx.run("/bin/bash", args, {
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
        const output = decodeBytes(chunks);
        const sentinelTimeout = /AIDIY_TIMEOUT/.test(output);
        return {
            status: result.status,
            timedOut: timedOut || sentinelTimeout || result.status === 124,
            output,
        };
    } catch (error) {
        const output = decodeBytes(chunks);
        if (isStoppedError(error)) {
            return { status: 130, timedOut: false, output };
        }
        if (timedOut || (error instanceof Error && /timed out/i.test(error.message))) {
            return { status: 124, timedOut: true, output };
        }
        resetRuntime();
        throw error;
    } finally {
        unsubscribe();
        if (booted) setRuntimePhase("ready");
    }
}

async function ensureWritableHome(cx: CheerpXLinux): Promise<void> {
    if (homeReady) return;
    const result = await runProcess(cx, ["-lc", HOME_BOOTSTRAP], "/", {
        uid: 0,
        gid: 0,
        timeoutMs: HOME_TIMEOUT_MS,
    });
    if (result.timedOut || result.status !== 0) {
        throw new Error(
            result.timedOut
                ? "Linux home setup timed out."
                : `Linux home setup failed (exit ${result.status}).`,
        );
    }
    homeReady = true;
}

const HOME_BOOTSTRAP = `mkdir -p /home/user /tmp /var/tmp
chown -R 1000:1000 /home/user
chmod 755 /home/user
chmod 1777 /tmp /var/tmp`;

export async function runCommand(
    cx: CheerpXLinux,
    command: string,
    opts?: { cwd?: string },
): Promise<LinuxCommandResult> {
    const source = String(command ?? "").trim();
    if (!source) {
        return { stdout: "", stderr: "No command provided.", exitCode: 1, timedOut: false };
    }
    const cwd = String(opts?.cwd ?? DEFAULT_CWD).trim() || DEFAULT_CWD;
    await ensureWritableHome(cx);
    const result = await runProcess(
        cx,
        ["-lc", source],
        cwd,
    );
    const stdout = capOutput(
        result.output.replace(/\n?AIDIY_TIMEOUT\n?/g, "").trimEnd(),
    );
    return {
        stdout,
        stderr: result.timedOut
            ? `Command timed out after ${COMMAND_TIMEOUT_SEC}s and was killed.`
            : result.status === 130
              ? "Stopped by user."
              : "",
        exitCode: result.timedOut ? 124 : result.status,
        timedOut: result.timedOut,
    };
}

const READ_WRAPPER = `set +e
path="$1"
max="$2"
if [ ! -e "$path" ]; then echo AIDIY_ERR:not_found; exit 2; fi
if [ -d "$path" ]; then echo AIDIY_ERR:is_directory; exit 2; fi
size=$(wc -c < "$path" | tr -d " ")
if [ "$size" -gt "$max" ]; then echo AIDIY_ERR:too_large:$size; exit 3; fi
echo AIDIY_B64_BEGIN
if base64 -w0 "$path" 2>/dev/null; then echo; else base64 "$path" | tr -d "\\n"; echo; fi
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

function formatCommandOutput(result: LinuxCommandResult): string {
    const parts = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exitCode: ${result.exitCode}`,
        result.timedOut ? "timedOut: true" : "",
    ].filter(Boolean);
    return capOutput(parts.join("\n\n") || "Command completed with no output.");
}

export function prefetchCheerpX(): void {
    if (typeof window === "undefined" || !cheerpxAvailable()) return;
    void loadCheerpX()
        .then((CX) => getCloudDevice(CX))
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
    input: { command?: string; cwd?: string; path?: string; maxBytes?: number },
    scopeId: string,
): Promise<LinuxClientResult> {
    if (!cheerpxAvailable()) {
        return { output: UNAVAILABLE_MESSAGE, artifacts: [] };
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
                    const result = await runCommand(cx, input.command ?? "", {
                        cwd: input.cwd,
                    });
                    if (result.exitCode === 130) {
                        return { output: "Stopped by user.", artifacts: [] };
                    }
                    return { output: formatCommandOutput(result), artifacts: [] };
                })(),
                COMMAND_TIMEOUT_MS + BOOT_TIMEOUT_MS,
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
            resetRuntime();
            setRuntimePhase("error");
            return {
                output: `Linux environment error: ${reason.slice(0, 800)}`,
                artifacts: [],
            };
        }
    });
}
