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

/** Classify a raw error / HTTP status into a structured user message. */
export function classifyProviderError(
    error: unknown,
    options?: { provider?: string; status?: number; context?: "chat" | "models" | "setup" },
): ProviderErrorParts {
    const raw =
        error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "";
    const status = options?.status;
    const label = providerLabel(options?.provider);
    const lower = raw.toLowerCase();

    let kind: ProviderErrorKind = "unknown";

    if (
        /only http\(s\)|valid http\(s\)|credentials must not be embedded|private.*not allowed/i.test(
            raw,
        )
    ) {
        kind = "url";
    } else if (
        status === 429 ||
        /\b429\b|rate limit|too many requests|throttl/i.test(raw)
    ) {
        kind = "rate_limit";
    } else if (
        /insufficient.?quota|insufficient.?credit|billing|payment.?required|credit.?balance|out of credits|quota.?exceeded/i.test(
            raw,
        ) ||
        status === 402
    ) {
        kind = "credits";
    } else if (
        status === 401 ||
        status === 403 ||
        /invalid.?api.?key|incorrect.?api.?key|unauthorized|forbidden|authentication|auth.?failed|api key/i.test(
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
    } else if (
        /model.?not.?found|does not exist|unknown model|not found.*model|model.*unavailable|no such model/i.test(
            raw,
        ) ||
        status === 404
    ) {
        kind = "model";
    } else if (/timeout|timed out|etimedout|aborted/i.test(raw)) {
        kind = "timeout";
    } else if (
        /network|fetch failed|econn|enotfound|econnrefused|failed to fetch|dns/i.test(
            raw,
        )
    ) {
        kind = "network";
    } else if (
        /api key required|model required|messages required|invalid json/i.test(raw)
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

    if (kind === "rate_limit") {
        parts.what = `${label} rate limit reached`;
        parts.why = `${label} returned a 429 — too many requests.`;
        parts.fix = "Wait a few seconds and retry, or switch model/provider.";
    } else if (kind === "auth") {
        parts.what = `${label} authentication failed`;
        parts.why = `Your ${label} API key was rejected or lacks permission.`;
        parts.fix = `Update the key in Settings or select another provider.`;
    } else if (kind === "credits") {
        parts.what = `${label} has insufficient credits`;
        parts.why = `The ${label} account cannot bill this request.`;
        parts.fix = `Add credits to your ${label} account or select another provider.`;
    } else if (kind === "model") {
        parts.what = "Model unavailable";
        parts.why = `${label} does not expose the selected model for this key.`;
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
