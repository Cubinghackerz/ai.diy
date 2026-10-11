/**
 * The Codex `client_version` this server reports to ChatGPT.
 *
 * ChatGPT gates the account's model list on it: a client that reports an old
 * version is silently denied newer models (GPT-6 / GPT-6.1 Sol and Luna are only
 * listed for recent releases), which looks exactly like "this plan has no new
 * models". 0.162.1 was the current stable Codex CLI release on 2026-10-09.
 *
 * `LWC_CLIENT_VERSION` can only raise it. Older deployments copied
 * `LWC_CLIENT_VERSION=0.147.0` from `.env.example`, and a value below the
 * built-in default has no use other than hiding models, so it is ignored.
 */

export const DEFAULT_LWC_CLIENT_VERSION = "0.162.1";

const VERSION = /^(\d+)\.(\d+)\.(\d+)/;

function parse(version: string): [number, number, number] | null {
    const match = VERSION.exec(version.trim());
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Negative when `a` is older than `b`. Ignores any pre-release suffix. */
export function compareClientVersions(a: string, b: string): number {
    const left = parse(a);
    const right = parse(b);
    if (!left || !right) return 0;
    for (let index = 0; index < 3; index += 1) {
        if (left[index] !== right[index]) return left[index] - right[index];
    }
    return 0;
}

let warned = false;

export function resolveClientVersion(configured = process.env.LWC_CLIENT_VERSION): string {
    const value = configured?.trim();
    if (!value) return DEFAULT_LWC_CLIENT_VERSION;
    if (!parse(value) || compareClientVersions(value, DEFAULT_LWC_CLIENT_VERSION) < 0) {
        if (!warned) {
            warned = true;
            console.warn(
                `[chatgpt] LWC_CLIENT_VERSION=${value.slice(0, 32)} is not newer than the built-in ${DEFAULT_LWC_CLIENT_VERSION}; using ${DEFAULT_LWC_CLIENT_VERSION} so new models stay visible. Remove the setting or raise it.`,
            );
        }
        return DEFAULT_LWC_CLIENT_VERSION;
    }
    return value;
}

/** Test hook: lets each test observe the one-time warning. */
export function resetClientVersionWarning() {
    warned = false;
}
