/**
 * First-run setup — TypingMind-style live key test, then unlock models.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { haptic, hapticConfirm, hapticSelect } from "~/lib/haptics";
import { testProviderKey } from "~/lib/key-test";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { isLocalProvider, isProviderReady } from "~/lib/setup";
import {
    PROVIDER_DEFAULTS,
    type ModelInfo,
    type ProviderId,
} from "~/lib/types";
import {
    ArrowRight,
    CaretDown,
    CheckCircle,
    HardDrives,
    Key,
    SpinnerGap,
    XCircle,
} from "@phosphor-icons/react";
import { cn } from "~/lib/utils";

const CLOUD_PROVIDERS: ProviderId[] = [
    "openai",
    "anthropic",
    "gemini",
    "groq",
    "openrouter",
];

const LOCAL_IDS: ProviderId[] = ["ollama", "custom"];

export function SetupGate() {
    const { settings, loaded, updateProvider, updateChat, updateSettings } =
        useSettings();

    const [provider, setProvider] = useState<ProviderId>(
        settings.chat.provider === "openai" &&
            !settings.providers.openai?.apiKey
            ? "openai"
            : settings.chat.provider || "openai",
    );
    const [apiKey, setApiKey] = useState(
        settings.providers[provider]?.apiKey || "",
    );
    const [baseUrl, setBaseUrl] = useState(
        settings.providers[provider]?.baseUrl ||
            PROVIDER_DEFAULTS[provider].baseUrl ||
            "",
    );
    const [model, setModel] = useState("");
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [testing, setTesting] = useState(false);
    const [verified, setVerified] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const local = isLocalProvider(provider);
    const keyReady = local || apiKey.trim().length > 0;

    useEffect(() => {
        const cfg = settings.providers[provider];
        setApiKey(cfg?.apiKey || "");
        setBaseUrl(cfg?.baseUrl || PROVIDER_DEFAULTS[provider].baseUrl || "");
        setModels([]);
        setModel("");
        setVerified(false);
        setError(null);
    }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectProvider = useCallback((id: ProviderId) => {
        hapticSelect();
        setProvider(id);
    }, []);

    const runTest = useCallback(async () => {
        if (!keyReady) return;
        haptic();
        setTesting(true);
        setError(null);
        const result = await testProviderKey({
            provider,
            apiKey,
            baseUrl,
        });
        setTesting(false);
        setModels(result.models);
        if (!result.ok) {
            setVerified(false);
            setError(result.error || "Key test failed.");
            return;
        }
        hapticConfirm();
        setVerified(true);
        setModel((prev) =>
            result.models.some((m) => m.id === prev)
                ? prev
                : result.models[0]?.id || "",
        );
    }, [keyReady, provider, apiKey, baseUrl]);

    const canContinue = verified && Boolean(model);

    const handleContinue = useCallback(() => {
        if (!canContinue) return;
        hapticConfirm();
        const storedKey = local
            ? apiKey.trim() || (provider === "ollama" ? "ollama" : "custom")
            : apiKey.trim();

        updateProvider(provider, {
            apiKey: storedKey,
            baseUrl: baseUrl || PROVIDER_DEFAULTS[provider].baseUrl,
            enabled: true,
        });
        updateChat({ provider, model });
        updateSettings({ setupComplete: true });
    }, [
        canContinue,
        local,
        apiKey,
        provider,
        baseUrl,
        model,
        updateProvider,
        updateChat,
        updateSettings,
    ]);

    const providerLabel = useMemo(
        () => PROVIDER_DEFAULTS[provider].name,
        [provider],
    );

    if (!loaded) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-background">
                <SpinnerGap className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-background px-4">
            <div className="relative z-10 flex w-full max-w-lg flex-col gap-8 animate-slide-up">
                <header className="flex flex-col items-center gap-3 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold tracking-tight text-primary-foreground">
                        a
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                            ai.diy
                        </h1>
                        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                            Enter your API key, run a live test against the
                            provider, then pick a model. Keys stay in this
                            browser.
                        </p>
                    </div>
                </header>

                <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Provider
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {CLOUD_PROVIDERS.map((id) => (
                                <ProviderChip
                                    key={id}
                                    active={provider === id}
                                    label={PROVIDER_DEFAULTS[id].name}
                                    onClick={() => selectProvider(id)}
                                />
                            ))}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {LOCAL_IDS.map((id) => (
                                <ProviderChip
                                    key={id}
                                    active={provider === id}
                                    label={PROVIDER_DEFAULTS[id].name}
                                    icon={<HardDrives size={14} />}
                                    onClick={() => selectProvider(id)}
                                />
                            ))}
                        </div>
                    </div>

                    {!local ? (
                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor="setup-api-key"
                                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                            >
                                <Key size={12} />
                                {providerLabel} API key
                            </label>
                            <Input
                                id="setup-api-key"
                                type="password"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder={`Paste your ${providerLabel} key…`}
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    setVerified(false);
                                    setError(null);
                                }}
                                className="h-10 rounded-xl bg-background font-mono text-sm"
                            />
                        </div>
                    ) : null}

                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="setup-base-url"
                            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                            Endpoint
                        </label>
                        <Input
                            id="setup-base-url"
                            type="url"
                            value={baseUrl}
                            onChange={(e) => {
                                setBaseUrl(e.target.value);
                                setVerified(false);
                            }}
                            className="h-10 rounded-xl bg-background font-mono text-sm"
                        />
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        disabled={!keyReady || testing}
                        onClick={runTest}
                        className="h-10 rounded-xl"
                    >
                        {testing ? (
                            <>
                                <SpinnerGap
                                    className="animate-spin"
                                    data-icon="inline-start"
                                />
                                {local ? "Testing endpoint…" : "Testing key…"}
                            </>
                        ) : (
                            "Test connection"
                        )}
                    </Button>

                    {error ? (
                        <p className="flex items-start gap-1.5 text-xs text-destructive">
                            <XCircle size={14} className="mt-0.5 shrink-0" />
                            {error}
                        </p>
                    ) : null}

                    {verified ? (
                        <div className="flex flex-col gap-2 animate-slide-up">
                            <label
                                htmlFor="setup-model"
                                className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                            >
                                Model
                                <CheckCircle
                                    size={12}
                                    className="text-success"
                                />
                            </label>
                            <div className="relative">
                                <select
                                    id="setup-model"
                                    value={model}
                                    onChange={(e) => {
                                        hapticSelect();
                                        setModel(e.target.value);
                                    }}
                                    className="h-10 w-full appearance-none rounded-xl border border-input bg-background py-2 pr-9 pl-3 text-sm font-medium outline-none"
                                >
                                    {models.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name || m.id}
                                        </option>
                                    ))}
                                </select>
                                <CaretDown
                                    size={14}
                                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Live test succeeded — choose a model to continue.
                            </p>
                        </div>
                    ) : (
                        <p className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                            {local
                                ? "Models unlock after a successful live call to this endpoint."
                                : "Models unlock after a successful live test call to this provider (same key + endpoint you entered)."}
                        </p>
                    )}

                    <Button
                        type="button"
                        size="lg"
                        disabled={!canContinue}
                        onClick={handleContinue}
                        className="h-11 w-full rounded-xl text-sm font-semibold"
                    >
                        Continue to chat
                        <ArrowRight data-icon="inline-end" />
                    </Button>
                </section>
            </div>
        </div>
    );
}

function ProviderChip({
    active,
    label,
    icon,
    onClick,
}: {
    active: boolean;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all outline-none active:scale-[0.97]",
                active
                    ? "border-foreground/30 bg-foreground/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
        >
            {icon}
            {label}
        </button>
    );
}

/** True when first-run setup should block the chat shell. */
export function useNeedsSetup(): boolean {
    const { settings, loaded } = useSettings();
    if (!loaded) return true;
    if (!settings.setupComplete) return true;
    return !isProviderReady(settings);
}
