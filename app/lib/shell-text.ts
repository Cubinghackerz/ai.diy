/**
 * Shell-text fast path — pure routing policy and output caps.
 *
 * The in-memory shell (just-bash, client-side) handles text/file/data commands
 * instantly with no VM boot. Compilers, runtimes, package managers, networking,
 * and background servers always go to the CheerpX Debian VM instead.
 *
 * This module is intentionally free of browser and just-bash imports so Node
 * smoke tests can exercise the policy directly (see scripts/shell-text-smoke.mjs).
 */

/** Mirrors the CheerpX 32KB combined-output cap so tool output stays bounded. */
export const SHELL_TEXT_OUTPUT_CAP = 32 * 1024;

/** Per-scope in-memory filesystem budget (tab memory, not IndexedDB). */
export const SHELL_TEXT_FS_CAP = 16 * 1024 * 1024;

/** Fast-path default deadline — matches the VM default so behavior never gaps. */
export const SHELL_TEXT_DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Fast-path ceiling — matches the VM ceiling. The wrapper races the exec
 * against this deadline, so a hung in-process statement can never stall the
 * tool past it (the scope is then reset for a clean next command).
 */
export const SHELL_TEXT_MAX_TIMEOUT_MS = 300_000;

/** Matches CheerpX DEFAULT_CWD so scripts behave the same on either runtime. */
export const SHELL_TEXT_DEFAULT_CWD = "/home/user";

const HEAVY_PATTERN =
    /(?:^|[;\n|&]|\|\||&&|\$\(|`)\s*(?:sudo|su\b|ssh|scp|ftp|apt(?:-get)?|aptitude|dpkg|rpm|yum|dnf|apk|pacman|brew|snap|flatpak|pip(?:3(?:\.\d+)?)?|conda|mamba|npm|npx|yarn|pnpm|bun|deno|gcc|g\+\+|cc|c\+\+|clang|make|cmake|ninja|meson|cargo|rustc|go\b|javac|java\b|kotlinc|node\b|python(?:3(?:\.\d+)?)?|ruby|php|perl|R\b|julia|gh\b|git|curl|wget|aria2c|nc\b|ncat|socat|ping|traceroute|nmap|iptables|systemctl|service\b|docker|podman|kubectl|helm|terraform|ansible|nohup|setsid|disown|tmux|screen|mount|umount|fdisk|mkfs|fsck|chroot|unshare|nsenter|strace|ltrace|gdb|valgrind|tcpdump|dmesg|insmod|rmmod|modprobe|sysctl|crontab|at\b|batch\b|tailscale|gzip|gunzip|zcat|bzip2)(?:\s|$|[;&|])/;

// A lone `&` backgrounds (even mid-line: `sleep 5 & wait`). `&&`, `2>&1`,
// `&>` digits, and escaped `\&` are not backgrounding. Quoted `&` may
// over-route to the VM — safe direction, the VM runs everything correctly.
const BACKGROUND_PATTERN = /(?<![\\&])&(?![&\d])/;

/**
 * True when a script needs the real Debian VM: compilers, runtimes, package
 * managers, network fetchers, version control, containers, backgrounding, or
 * privilege/system operations. Everything else is eligible for the fast path.
 */
export function needsHeavyToolchain(source: string): boolean {
    const text = String(source ?? "");
    if (!text.trim()) return false;
    const lines = text.split("\n").filter((line) => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith("#");
    });
    if (lines.some((line) => HEAVY_PATTERN.test(`\n${line} `))) return true;
    if (BACKGROUND_PATTERN.test(text)) return true;
    return false;
}

/** Clamp a requested timeout into the fast-path deadline window. */
export function resolveShellTextTimeoutMs(timeoutSec?: number): number {
    const requestedMs = Math.round(Number(timeoutSec) * 1000);
    if (Number.isFinite(requestedMs) && requestedMs > 0) {
        return Math.min(SHELL_TEXT_MAX_TIMEOUT_MS, requestedMs);
    }
    return SHELL_TEXT_DEFAULT_TIMEOUT_MS;
}

/** Truncate combined output at the 32KB cap, mirroring CheerpX's marker style. */
export function capShellTextOutput(text: string): string {
    if (text.length <= SHELL_TEXT_OUTPUT_CAP) return text;
    return `${text.slice(0, SHELL_TEXT_OUTPUT_CAP)}\n[truncated: output exceeded 32KB]`;
}

/** True when a just-bash failure means "unsupported here" (fall back to the VM). */
export function isCommandNotFound(exitCode: number, stderr: string): boolean {
    return exitCode === 127 && /command not found/i.test(String(stderr ?? ""));
}

/** Render a fast-path result in the same shape as CheerpX command output. */
export function formatShellTextOutput(result: {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    durationMs?: number;
}): string {
    const parts = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exitCode: ${result.exitCode}`,
        result.timedOut ? "timedOut: true" : "",
        result.durationMs != null ? `durationMs: ${result.durationMs}` : "",
    ].filter(Boolean);
    return capShellTextOutput(parts.join("\n\n") || "Command completed with no output.");
}
