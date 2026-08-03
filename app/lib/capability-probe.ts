/**
 * Client helpers for per-model capability probing of OpenAI-compatible
 * endpoints. Uses only the key / base URL the user entered — never env vars.
 */

import type {
    ProbeReport,
    ProbeRequest,
} from "~/lib/server/capability-probe";
import { isLocalProvider } from "~/lib/setup";
import { localProviderKey } from "~/lib/provider-credentials";
import type { ProviderConfig, ProviderId } from "~/lib/types";

export type CapabilityProbeResult = {
    ok: boolean;
    report?: ProbeReport;
    error?: string;
};

/**
 * Live probe: POST /api/capabilities with the exact key + endpoint + model
 * the user configured. Runs bounded per-capability checks and returns a
 * report with per-probe latency and errors.
 */
export async function probeModelCapabilities(options: {
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
    model: string;
    openAICompatible?: ProviderConfig["openAICompatible"];
}): Promise<CapabilityProbeResult> {
    const { provider, apiKey, baseUrl, model, openAICompatible } = options;
    const key = apiKey.trim();

    if (!isLocalProvider(provider) && !key) {
        return { ok: false, error: "Enter an API key to probe capabilities." };
    }
    if (!model.trim()) {
        return { ok: false, error: "Enter a model ID to probe." };
    }

    try {
        const res = await fetch("/api/capabilities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                provider,
                apiKey: key || localProviderKey(provider),
                baseUrl: baseUrl || undefined,
                model: model.trim(),
                openAICompatible,
            } satisfies ProbeRequest),
        });
        const data = (await res.json()) as {
            report?: ProbeReport;
            error?: string;
        };

        if (!res.ok || data.error || !data.report) {
            return {
                ok: false,
                error:
                    data.error ||
                    `Capability probing failed (HTTP ${res.status}).`,
            };
        }
        return { ok: true, report: data.report };
    } catch (err) {
        return {
            ok: false,
            error:
                err instanceof Error
                    ? err.message
                    : "Network error while probing capabilities.",
        };
    }
}
