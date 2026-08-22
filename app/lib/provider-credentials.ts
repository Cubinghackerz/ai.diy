import type { ProviderId } from "~/lib/types";

export type ProviderCredentials = {
    apiKey?: string;
    baseURL?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    resourceName?: string;
    apiVersion?: string;
    project?: string;
    location?: string;
    clientEmail?: string;
    privateKey?: string;
};

/** Accept a plain key as well as the structured credential JSON used by SDKs. */
export function parseProviderCredentials(
    _provider: ProviderId,
    value: string,
): ProviderCredentials {
    const raw = value.trim();
    if (!raw.startsWith("{")) return { apiKey: raw };

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return { apiKey: raw };
        }
        return parsed as ProviderCredentials;
    } catch {
        // Preserve the original value so the provider can return its normal error.
        return { apiKey: raw };
    }
}

export function providerNeedsKey(provider: ProviderId): boolean {
    return !["ollama", "custom", "lmstudio", "chatgpt", "grok"].includes(provider);
}

export function localProviderKey(provider: ProviderId): string {
    switch (provider) {
        case "ollama":
            return "ollama";
        case "lmstudio":
            return "lmstudio";
        case "custom":
            return "custom";
        case "chatgpt":
            return "chatgpt-subscription";
        case "grok":
            return "grok-build-subscription";
        default:
            return "";
    }
}
