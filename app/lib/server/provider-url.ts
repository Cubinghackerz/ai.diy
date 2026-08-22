import { assertPublicHttpUrl } from "~/lib/server/ssrf";
import type { ProviderId } from "~/lib/types";

const OPENAI_COMPATIBLE_PROVIDERS = new Set<ProviderId>([
    "openai",
    "groq",
    "cerebras",
    "fireworks",
    "openrouter",
    "xai",
    "grok",
    "deepseek",
    "togetherai",
    "mistral",
    "huggingface",
    "ollama",
    "lmstudio",
    "custom",
]);

const OPENAI_ENDPOINT_SUFFIX = /\/(?:chat\/completions|responses|models|embeddings)\/?$/i;

function privateNetworkUrlsAllowed(): boolean {
    return process.env.NODE_ENV !== "production" || process.env.ALLOW_PRIVATE_PROVIDER_URLS === "true";
}

/**
 * Validates a user-configured outbound URL. Public hosted deployments reject
 * private targets unless the operator explicitly opts into private networking.
 */
export function assertConfiguredHttpUrl(raw: string): URL {
    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        throw new Error("Enter a valid http(s) URL.");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Only http(s) URLs are allowed.");
    }
    if (url.username || url.password) {
        throw new Error("Credentials must not be embedded in the URL.");
    }
    if (!privateNetworkUrlsAllowed()) assertPublicHttpUrl(url.toString());
    return url;
}

/**
 * Accept an API root or a common OpenAI endpoint and return the API root.
 * It intentionally does not append `/v1`: compatible providers differ.
 */
export function normalizeProviderBaseUrl(
    provider: ProviderId,
    raw?: string,
): string | undefined {
    if (provider === "grok") return undefined;
    if (!raw?.trim()) return undefined;
    const url = assertConfiguredHttpUrl(raw);
    if (OPENAI_COMPATIBLE_PROVIDERS.has(provider)) {
        url.pathname = url.pathname.replace(OPENAI_ENDPOINT_SUFFIX, "");
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
}
