import type { ProviderId } from "~/lib/types";

export const OAUTH_SUBSCRIPTION_PROVIDERS = ["chatgpt", "grok", "kimi"] as const;
export const KEY_SUBSCRIPTION_PROVIDERS = ["glm", "minimax"] as const;

export type OauthSubscriptionProvider = (typeof OAUTH_SUBSCRIPTION_PROVIDERS)[number];
export type KeySubscriptionProvider = (typeof KEY_SUBSCRIPTION_PROVIDERS)[number];

export function isOauthSubscriptionProvider(
    provider: ProviderId | string,
): provider is OauthSubscriptionProvider {
    return (OAUTH_SUBSCRIPTION_PROVIDERS as readonly string[]).includes(provider);
}

export function isKeySubscriptionProvider(
    provider: ProviderId | string,
): provider is KeySubscriptionProvider {
    return (KEY_SUBSCRIPTION_PROVIDERS as readonly string[]).includes(provider);
}

export function isSubscriptionProvider(provider: ProviderId | string): boolean {
    return isOauthSubscriptionProvider(provider) || isKeySubscriptionProvider(provider);
}

export const BETA_SUBSCRIPTION_PROVIDERS = ["kimi", "glm", "minimax"] as const;

export function isBetaSubscriptionProvider(provider: ProviderId | string): boolean {
    return (BETA_SUBSCRIPTION_PROVIDERS as readonly string[]).includes(provider);
}

export function subscriptionRateLimitKey(provider: ProviderId): string | null {
    switch (provider) {
        case "chatgpt":
            return "chatgpt-subscription";
        case "grok":
            return "grok-build-subscription";
        case "kimi":
            return "kimi-membership";
        case "glm":
            return "glm-coding-plan";
        case "minimax":
            return "minimax-token-plan";
        default:
            return null;
    }
}