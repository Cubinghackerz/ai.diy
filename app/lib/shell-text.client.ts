/**
 * In-memory shell fast path — client-executed, like Pyodide.
 *
 * Each conversation scope gets its own just-bash instance (shared filesystem
 * across execs within the scope, isolated between scopes). The just-bash
 * browser bundle loads lazily on first use so the main chunk stays lean.
 * Memory is session-only: unlike the CheerpX IndexedDB overlay, files written
 * here do not survive a tab reload.
 */

import type { Bash } from "just-bash/browser";
import {
    SHELL_TEXT_DEFAULT_CWD,
    SHELL_TEXT_FS_CAP,
    capShellTextOutput,
    isCommandNotFound,
    resolveShellTextTimeoutMs,
} from "~/lib/shell-text";
import type { LinuxArtifact, LinuxClientResult, LinuxCommandResult } from "~/lib/cheerpx";

type BashModule = typeof import("just-bash/browser");

type BashInstance = Pick<Bash, "exec" | "fs">;

let bashModulePromise: Promise<BashModule> | null = null;
const scopeInstances = new Map<string, Promise<BashInstance>>();

function loadShellText(): Promise<BashModule> {
    if (!bashModulePromise) {
        bashModulePromise = import("just-bash/browser").catch((error) => {
            bashModulePromise = null;
            throw error;
        });
    }
    return bashModulePromise;
}

function sanitizeScopeId(scopeId: string): string {
    const cleaned = String(scopeId ?? "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    return cleaned || "draft";
}

function getScopeBash(scopeId: string): Promise<BashInstance> {
    const key = sanitizeScopeId(scopeId);
    let pending = scopeInstances.get(key);
    if (!pending) {
        pending = loadShellText().then((mod) => {
            const fs = new mod.InMemoryFs(undefined, { maxTotalBytes: SHELL_TEXT_FS_CAP });
            return new mod.Bash({
                cwd: SHELL_TEXT_DEFAULT_CWD,
                fs,
                env: {
                    HOME: SHELL_TEXT_DEFAULT_CWD,
                    USER: "user",
                    SHELL: "/bin/bash",
                    LANG: "en_US.UTF-8",
                    TERM: "xterm-256color",
                    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                },
                executionLimitProfile: "hardened",
                executionLimits: { maxFileSystemBytes: SHELL_TEXT_FS_CAP },
            });
        });
        scopeInstances.set(key, pending);
        pending.catch(() => {
            if (scopeInstances.get(key) === pending) scopeInstances.delete(key);
        });
    }
    return pending;
}

/** Drop a scope's shell (timeout hygiene + thread deletion cleanup). */
export function dropShellTextScope(scopeId: string): void {
    scopeInstances.delete(sanitizeScopeId(scopeId));
}

function resolveCwd(cwd?: string): string {
    const trimmed = String(cwd ?? "").trim();
    return trimmed || SHELL_TEXT_DEFAULT_CWD;
}

function resolvePath(cwd: string, path: string): string {
    const target = String(path ?? "").trim();
    if (target.startsWith("/")) return target;
    return `${cwd.replace(/\/+$/, "")}/${target}`;
}

/**
 * Run a script in the scope's in-memory shell. Returns null only when the
 * shell itself failed to load (caller may fall back to the VM). A missing
 * command is a normal 127 result — the caller must not re-run the script.
 */
export async function runShellTextCommand(
    scopeId: string,
    command: string,
    opts?: { cwd?: string; timeoutSec?: number; signal?: AbortSignal },
): Promise<{ result: LinuxCommandResult; unsupported: boolean } | null> {
    const source = String(command ?? "").trim();
    if (!source) {
        return {
            result: { stdout: "", stderr: "No command provided.", exitCode: 1, timedOut: false },
            unsupported: false,
        };
    }
    let bash: BashInstance;
    try {
        bash = await getScopeBash(scopeId);
    } catch {
        return null;
    }
    const timeoutMs = resolveShellTextTimeoutMs(opts?.timeoutSec);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    opts?.signal?.addEventListener("abort", onAbort, { once: true });
    const startedAt = Date.now();
    // Race the exec against the deadline: cancellation is cooperative
    // (statement boundaries), so a hung statement must not stall past it.
    // The scope is reset on timeout so the next command starts clean.
    let timer: number | undefined;
    let expired = false;
    const deadline = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => {
            expired = true;
            controller.abort();
            reject(new Error("ShellTextDeadline"));
        }, timeoutMs);
    });
    try {
        const raw = await Promise.race([
            bash.exec(source, { cwd: resolveCwd(opts?.cwd), signal: controller.signal }),
            deadline,
        ]);
        const durationMs = Date.now() - startedAt;
        const unsupported = isCommandNotFound(raw.exitCode, raw.stderr);
        return {
            result: {
                stdout: capShellTextOutput(raw.stdout),
                stderr: capShellTextOutput(raw.stderr),
                exitCode: raw.exitCode,
                timedOut: false,
                durationMs,
            },
            unsupported,
        };
    } catch {
        const durationMs = Date.now() - startedAt;
        const userStopped = opts?.signal?.aborted === true;
        if (userStopped) {
            return {
                result: {
                    stdout: "",
                    stderr: "Stopped by user.",
                    exitCode: 130,
                    timedOut: false,
                    durationMs,
                },
                unsupported: false,
            };
        }
        if (expired) {
            // A timed-out statement may have partially written. Reset so the
            // next command does not observe a half-applied script. User stop
            // keeps prior files — Stop should not wipe the session shell.
            dropShellTextScope(scopeId);
            return {
                result: {
                    stdout: "",
                    stderr: `Command timed out after ${Math.round(timeoutMs / 1000)}s and was stopped.`,
                    exitCode: 124,
                    timedOut: true,
                    durationMs,
                },
                unsupported: false,
            };
        }
        // Unexpected exec failure (not a timeout or stop) — let the caller
        // fall back to the VM or report unavailability.
        return null;
    } finally {
        if (timer !== undefined) window.clearTimeout(timer);
        opts?.signal?.removeEventListener("abort", onAbort);
    }
}

function base64Encode(bytes: Uint8Array): string {
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

function looksLikeText(bytes: Uint8Array): boolean {
    const sample = bytes.subarray(0, Math.min(bytes.length, 2048));
    for (const byte of sample) {
        if (byte === 0) return false;
    }
    return true;
}

/**
 * Read a file from the scope's in-memory shell FS as a Canvas artifact.
 * Returns null when absent (caller falls back to the VM).
 */
export async function readShellTextFile(
    scopeId: string,
    path: string,
    maxBytes = 2 * 1024 * 1024,
): Promise<LinuxClientResult | null> {
    const target = String(path ?? "").trim();
    if (!target) return { output: "read_file error: no path provided.", artifacts: [] };
    const cap = Math.min(Math.max(1, maxBytes), 2 * 1024 * 1024);
    let bash: BashInstance;
    try {
        bash = await getScopeBash(scopeId);
    } catch {
        return null;
    }
    let bytes: Uint8Array;
    try {
        bytes = await bash.fs.readFileBuffer(resolvePath(SHELL_TEXT_DEFAULT_CWD, target));
    } catch {
        return null;
    }
    if (bytes.byteLength > cap) {
        return {
            output: `read_file error: ${target} is ${bytes.byteLength} bytes (limit ${cap} bytes / 2 MiB).`,
            artifacts: [],
        };
    }
    if (bytes.byteLength === 0) {
        return { output: `read_file: ${target} is empty.`, artifacts: [] };
    }
    const filename = (target.split("/").filter(Boolean).pop() || "file").replace(/[\\/]/g, "_");
    const artifact: LinuxArtifact = {
        filename,
        content: base64Encode(bytes),
        contentEncoding: "base64",
    };
    const preview = looksLikeText(bytes)
        ? new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 8_000)
        : "";
    const summary = preview
        ? `Read ${target} (${bytes.byteLength} bytes). Canvas artifact: \`${artifact.filename}\`.\n\n${preview}`
        : `Read ${target} (${bytes.byteLength} bytes). Canvas artifact: \`${artifact.filename}\`.`;
    return { output: summary, artifacts: [artifact] };
}
