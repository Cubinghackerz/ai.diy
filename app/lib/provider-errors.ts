/**
 * User-facing provider/API errors: what happened → why → what to do.
 * Safe for the client (never echo raw secrets or full request bodies).
 */

export type ProviderErrorKind =
    | "auth"
    | "credits"
    | "rate_limit"
    | "model"
    | "context"
    | "network"
    | "timeout"
    | "url"
    | "config"
    | "unknown";

export interface ProviderErrorParts {
    kind: ProviderErrorKind;
    /** Short title shown first. */
    what: string;
    /** One-line cause. */
    why: string;
    /** Actionable fix. */
    fix: string;
}

const KIND_DEFAULTS: Record<ProviderErrorKind, Omit<ProviderErrorParts, "kind">> = {
    auth: {
        what: "Provider authentication failed",
        why: "The API key was rejected or lacks permission.",
        fix: "Check the key in Settings, regenerate it at the provider, or switch providers.",
    },
    credits: {
        what: "Provider credits exhausted",
        why: "This account has insufficient balance or quota for the request.",
        fix: "Add credits on the provider dashboard or select another provider.",
    },
    rate_limit: {
        what: "Provider rate limit reached",
        why: "Too many requests were sent in a short window (HTTP 429).",
        fix: "Wait a few seconds and retry, lower concurrency, or upgrade the provider plan.",
    },
    model: {
        what: "Model unavailable",
        why: "The selected model was not found or is not enabled for this key.",
        fix: "Pick another model from the picker, or confirm the model id with your provider.",
    },
    context: {
        what: "Context window exceeded",
        why: "The conversation or attachments are too large for this model.",
        fix: "Start a new chat, remove large files, or choose a model with a larger context window.",
    },
    network: {
        what: "Could not reach the provider",
        why: "The network request failed before a usable response arrived.",
        fix: "Check the API root, VPN/firewall, and that the provider is online.",
    },
    timeout: {
        what: "Provider request timed out",
        why: "The provider did not respond in time.",
        fix: "Retry the request; if it keeps failing, raise the timeout for custom endpoints or try another model.",
    },
    url: {
        what: "Provider URL rejected",
        why: "The configured API root failed validation (scheme, credentials, or private network).",
        fix: "Use a public HTTPS API root, or set ALLOW_PRIVATE_PROVIDER_URLS=true only on a trusted self-hosted host.",
    },
    config: {
        what: "Chat request misconfigured",
        why: "Required fields such as model or API key are missing.",
        fix: "Finish setup: add a key (if required) and select a model, then try again.",
    },
    unknown: {
        what: "Provider request failed",
        why: "The provider returned an error or an unexpected response.",
        fix: "Check the selected model and provider compatibility, then retry.",
    },
};

function providerLabel(provider?: string): string {
    if (!provider?.trim()) return "The provider";
    const id = provider.trim();
    const known: Record<string, string> = {
        openai: "OpenAI",
        chatgpt: "ChatGPT (subscription)",
        anthropic: "Anthropic",
        gemini: "Google Gemini",
        groq: "Groq",
        openrouter: "OpenRouter",
        deepseek: "DeepSeek",
        bedrock: "Amazon Bedrock",
        azure: "Azure OpenAI",
        vertex: "Google Vertex AI",
        gateway: "Vercel AI Gateway",
        togetherai: "Together AI",
        mistral: "Mistral",
        huggingface: "Hugging Face",
        lmstudio: "LM Studio",
        xai: "xAI",
        ollama: "Ollama",
        custom: "Your custom endpoint",
    };
    return known[id] ?? id;
}

function extractNestedProviderDetail(raw: string): string {
    // AI SDK / LWC often nest: {"error":"…","detail":"{\"error\":{…}}"}
    const detailMatch = /"detail"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(raw);
    if (detailMatch?.[1]) {
        try {
            return JSON.parse(`"${detailMatch[1]}"`) as string;
        } catch {
            return detailMatch[1].replace(/\\"/g, '"');
        }
    }
    return raw;
}

/**
 * AI SDK wraps provider failures in RetryError (`lastError` / `errors[]`) whose
 * top-level message is only "Failed after N attempts…". Pull nested bodies so
 * usage_limit / plan_type still classify.
 */
function collectProviderErrorText(error: unknown, depth = 0): string {
    if (error == null || depth > 6) return "";
    if (typeof error === "string") return error;
    const chunks: string[] = [];
    if (error instanceof Error) {
        if (error.message.trim()) chunks.push(error.message);
    }
    if (typeof error === "object") {
        const record = error as Record<string, unknown>;
        if (typeof record.responseBody === "string" && record.responseBody.trim()) {
            chunks.push(record.responseBody);
        }
        if (typeof record.statusCode === "number") {
            chunks.push(`status ${record.statusCode}`);
        }
        if (record.lastError != null) {
            chunks.push(collectProviderErrorText(record.lastError, depth + 1));
        }
        if (Array.isArray(record.errors)) {
            for (const nested of record.errors) {
                chunks.push(collectProviderErrorText(nested, depth + 1));
            }
        }
        if (record.cause != null) {
            chunks.push(collectProviderErrorText(record.cause, depth + 1));
        }
        if (typeof record.data === "string" && record.data.trim()) {
            chunks.push(record.data);
        }
    }
    return chunks.filter(Boolean).join("\n");
}

function extractProviderStatus(error: unknown, depth = 0): number | undefined {
    if (error == null || depth > 6 || typeof error !== "object") return undefined;
    const record = error as Record<string, unknown>;
    if (typeof record.statusCode === "number") return record.statusCode;
    if (typeof record.status === "number") return record.status;
    const nested =
        extractProviderStatus(record.lastError, depth + 1) ??
        (Array.isArray(record.errors)
            ? record.errors
                  .map((e) => extractProviderStatus(e, depth + 1))
                  .find((s): s is number => typeof s === "number")
            : undefined) ??
        extractProviderStatus(record.cause, depth + 1);
    return nested;
}

function parseUsageLimitMeta(text: string): {
    planType?: string;
    resetsInSeconds?: number;
    message?: string;
} {
    const haystack = extractNestedProviderDetail(text);
    try {
        const parsed = JSON.parse(haystack) as {
            error?: {
                type?: string;
                message?: string;
                plan_type?: string;
                resets_in_seconds?: number;
            };
        };
        if (parsed?.error) {
            return {
                planType: parsed.error.plan_type,
                resetsInSeconds: parsed.error.resets_in_seconds,
                message: parsed.error.message,
            };
        }
    } catch {
        /* fall through to regex */
    }
    const plan =
        /"plan_type"\s*:\s*"([^"]+)"/i.exec(haystack)?.[1] ??
        /plan_type[=:]\s*([a-z0-9_+-]+)/i.exec(haystack)?.[1];
    const resetsRaw = /"resets_in_seconds"\s*:\s*(\d+)/i.exec(haystack)?.[1];
    return {
        planType: plan,
        resetsInSeconds: resetsRaw ? Number.parseInt(resetsRaw, 10) : undefined,
        message: /usage limit has been reached/i.test(haystack)
            ? "The usage limit has been reached"
            : undefined,
    };
}

function formatResetHint(seconds?: number): string | null {
    if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.ceil(s / 60)} minutes`;
    if (s < 86_400) return `${Math.ceil(s / 3600)} hours`;
    return `${Math.ceil(s / 86_400)} days`;
}

/** Classify a raw error / HTTP status into a structured user message. */
export function classifyProviderError(
    error: unknown,
    options?: { provider?: string; status?: number; context?: "chat" | "models" | "setup" },
): ProviderErrorParts {
    const raw = collectProviderErrorText(error);
    const status = options?.status ?? extractProviderStatus(error);
    const label = providerLabel(options?.provider);
    const lower = raw.toLowerCase();
    const usageMeta = parseUsageLimitMeta(raw);

    let kind: ProviderErrorKind = "unknown";

    if (
        /only http\(s\)|valid http\(s\)|credentials must not be embedded|private.*not allowed/i.test(
            raw,
        )
    ) {
        kind = "url";
    } else if (
        /usage_limit_reached|usage limit has been reached|insufficient.?quota|insufficient.?credit|billing|payment.?required|credit.?balance|out of credits|quota.?exceeded/i.test(
            raw,
        ) ||
        status === 402 ||
        (status === 429 && /plan_type|usage.?limit/i.test(raw))
    ) {
        kind = "credits";
    } else if (
        status === 429 ||
        /\b429\b|rate limit|too many requests|throttl|rate_limited/i.test(raw)
    ) {
        kind = "rate_limit";
    } else if (
        /model_not_allowed|model.?not.?found|does not exist|unknown model|not found.*model|model.*unavailable|no such model/i.test(
            raw,
        ) ||
        status === 404
    ) {
        kind = "model";
    } else if (
        status === 401 ||
        status === 403 ||
        /invalid.?api.?key|incorrect.?api.?key|unauthorized|forbidden|authentication|auth.?failed|not_authenticated|api key/i.test(
            raw,
        )
    ) {
        kind = "auth";
    } else if (
        /context.?length|maximum.?context|token.?limit|too many tokens|prompt.?is.?too.?long|max.?tokens/i.test(
            raw,
        )
    ) {
        kind = "context";
    } else if (/timeout|timed out|etimedout|aborted/i.test(raw)) {
        kind = "timeout";
    } else if (
        /network|fetch failed|econn|enotfound|econnrefused|failed to fetch|dns/i.test(
            raw,
        )
    ) {
        kind = "network";
    } else if (
        /api key required|model required|messages required|invalid json|sign in with chatgpt/i.test(
            raw,
        )
    ) {
        kind = "config";
    }

    const base = KIND_DEFAULTS[kind];
    const parts: ProviderErrorParts = {
        kind,
        what: base.what,
        why: base.why,
        fix: base.fix,
    };

    if (
        kind === "credits" &&
        (/usage_limit|plan_type|chatgpt/i.test(lower) ||
            options?.provider === "chatgpt" ||
            usageMeta.planType)
    ) {
        const plan = usageMeta.planType || "your ChatGPT plan";
        const reset = formatResetHint(usageMeta.resetsInSeconds);
        parts.what = "ChatGPT plan usage limit reached";
        parts.why = usageMeta.message
            ? `${usageMeta.message} (plan: ${plan}).`
            : `This ChatGPT ${plan} account has hit its usage limit for Codex/subscription requests.`;
        parts.fix = reset
            ? `Wait about ${reset} for the limit to reset, upgrade your ChatGPT plan, or switch to a BYOK provider (OpenAI API key, OpenRouter, etc.).`
            : "Upgrade your ChatGPT plan, wait for the limit to reset, or switch to a BYOK provider (OpenAI API key, OpenRouter, etc.).";
    } else if (kind === "rate_limit") {
        parts.what = `${label} rate limit reached`;
        parts.why = `${label} returned a 429 — too many requests.`;
        parts.fix =
            options?.provider === "chatgpt"
                ? "Wait a few seconds and retry, or check whether your ChatGPT plan hit a usage limit."
                : "Wait a few seconds and retry, or switch model/provider.";
    } else if (kind === "auth") {
        parts.what = `${label} authentication failed`;
        parts.why =
            options?.provider === "chatgpt"
                ? "Your ChatGPT session expired or is not signed in."
                : `Your ${label} API key was rejected or lacks permission.`;
        parts.fix =
            options?.provider === "chatgpt"
                ? "Reconnect under Settings → Experimental → Login with ChatGPT."
                : `Update the key in Settings or select another provider.`;
    } else if (kind === "credits") {
        parts.what = `${label} has insufficient credits`;
        parts.why = `The ${label} account cannot bill this request.`;
        parts.fix = `Add credits to your ${label} account or select another provider.`;
    } else if (kind === "model") {
        parts.what = "Model unavailable";
        parts.why =
            options?.provider === "chatgpt"
                ? "This model is not available on your signed-in ChatGPT account/plan."
                : `${label} does not expose the selected model for this key.`;
        parts.fix =
            options?.provider === "chatgpt"
                ? "Open the model picker and choose a model returned for your account, or upgrade your ChatGPT plan."
                : parts.fix;
    } else if (kind === "url" && raw.trim()) {
        parts.why = raw.trim();
    } else if (kind === "config" && raw.trim()) {
        parts.why = raw.trim();
    } else if (options?.context === "models" && kind === "unknown") {
        parts.what = "Model discovery failed";
        parts.why = "Could not list models from this provider.";
        parts.fix = "Check the API root and key, or pick a fallback model manually.";
    }

    return parts;
}

/** Single multi-line string for JSON error bodies and message UIs. */
export function formatProviderError(
    error: unknown,
    options?: { provider?: string; status?: number; context?: "chat" | "models" | "setup" },
): string {
    const parts = classifyProviderError(error, options);
    return `${parts.what}\n\n${parts.why}\n\nFix: ${parts.fix}`;
}

/** Preserve structured fields for clients that prefer JSON. */
export function providerErrorPayload(
    error: unknown,
    options?: { provider?: string; status?: number; context?: "chat" | "models" | "setup" },
): ProviderErrorParts & { error: string } {
    const parts = classifyProviderError(error, options);
    return {
        ...parts,
        error: formatProviderError(error, options),
    };
}

/** Map HTTP status for classified chat failures. */
export function httpStatusForProviderError(kind: ProviderErrorKind): number {
    switch (kind) {
        case "auth":
            return 401;
        case "credits":
            return 402;
        case "rate_limit":
            return 429;
        case "config":
        case "url":
            return 400;
        case "model":
            return 404;
        default:
            return 502;
    }
}
