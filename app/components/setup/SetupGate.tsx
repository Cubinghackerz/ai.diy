/**
 * First-run setup — TypingMind-style live key test, then unlock models.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SearchableModelSelect } from "~/components/ui/ModelPicker";
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
    CheckCircle,
    HardDrives,
    Key,
    ShieldCheck,
    SpinnerGap,
    XCircle,
} from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { localProviderKey } from "~/lib/provider-credentials";

const CLOUD_PROVIDERS: ProviderId[] = [
    "openai",
    "anthropic",
    "gemini",
    "groq",
    "cerebras",
    "fireworks",
    "perplexity",
    "cohere",
    "openrouter",
    "xai",
    "deepseek",
    "bedrock",
    "azure",
    "vertex",
    "gateway",
    "togetherai",
    "mistral",
    "huggingface",
];

const LOCAL_IDS: ProviderId[] = ["ollama", "lmstudio", "custom"];

const CREDENTIAL_HINTS: Partial<Record<ProviderId, string>> = {
    bedrock:
        '{"accessKeyId":"…","secretAccessKey":"…","region":"us-east-1"}',
    azure: '{"resourceName":"my-resource","apiKey":"…"}',
    vertex:
        '{"project":"my-project","location":"us-central1","clientEmail":"…","privateKey":"…"}',
};

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
            ? apiKey.trim() || localProviderKey(provider)
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

    const step = !keyReady ? 1 : !verified ? 2 : 3;

    if (!loaded) {
        return (
            <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#070708]">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(255,255,255,0.08),transparent_55%)]"
                />
                <SpinnerGap className="size-6 animate-spin text-zinc-400" />
            </div>
        );
    }

    return (
        <div className="relative flex h-dvh min-h-0 w-full items-start justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-[#070708] px-4 py-6 text-zinc-100 sm:py-12">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(255,255,255,0.12),transparent_58%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.08)_0.6px,transparent_0.6px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_85%_70%_at_50%_20%,#000_15%,transparent_75%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[18%] h-64 w-[36rem] -translate-x-1/2 rounded-full bg-white/[0.04] blur-3xl"
            />

            <div className="relative z-10 flex w-full max-w-xl flex-col gap-7 py-2 animate-slide-up sm:gap-8">
                <header className="flex flex-col items-center gap-4 text-center">
                    <div className="relative">
                        <div
                            aria-hidden
                            className="absolute -inset-3 rounded-[1.75rem] bg-white/[0.08] blur-xl"
                        />
                        <img
                            src="/ai-diy.png"
                            alt="ai.diy"
                            className="relative size-14 rounded-[1.15rem] object-cover shadow-[0_18px_50px_-20px_rgba(255,255,255,0.45)] ring-1 ring-white/15"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-white sm:text-[2.15rem]">
                            ai.diy
                        </h1>
                        <p className="mx-auto max-w-md text-[14px] leading-relaxed text-zinc-400">
                            Connect a provider, live-test the key, then unlock models.
                            Credentials stay in this browser — never on the server.
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] tracking-wide text-zinc-400">
                        <ShieldCheck weight="fill" className="size-3.5 text-emerald-400" />
                        Local-first · BYOK · browser storage
                    </div>
                </header>

                <section className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-[#0e0e11]/80 p-5 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-6">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)]"
                    />

                    <div className="relative mb-5 grid grid-cols-3 gap-2">
                        {[
                            { n: 1, label: "Provider" },
                            { n: 2, label: "Verify" },
                            { n: 3, label: "Model" },
                        ].map((item) => {
                            const done = step > item.n || (item.n === 3 && verified);
                            const active = step === item.n;
                            return (
                                <div
                                    key={item.n}
                                    className={cn(
                                        "rounded-xl border px-2.5 py-2 text-center transition-colors",
                                        done || active
                                            ? "border-white/15 bg-white/[0.06]"
                                            : "border-white/[0.06] bg-white/[0.02]",
                                    )}
                                >
                                    <p
                                        className={cn(
                                            "font-mono text-[10px] tracking-wide",
                                            done || active ? "text-zinc-200" : "text-zinc-500",
                                        )}
                                    >
                                        {String(item.n).padStart(2, "0")}
                                    </p>
                                    <p
                                        className={cn(
                                            "mt-0.5 text-[11px] font-medium",
                                            done || active ? "text-white" : "text-zinc-500",
                                        )}
                                    >
                                        {item.label}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="relative flex flex-col gap-5">
                        <div className="flex flex-col gap-2.5">
                            <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
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
                                        icon={<HardDrives size={13} weight="light" />}
                                        onClick={() => selectProvider(id)}
                                    />
                                ))}
                            </div>
                        </div>

                        {!local ? (
                            <div className="flex flex-col gap-2">
                                <label
                                    htmlFor="setup-api-key"
                                    className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500"
                                >
                                    <Key size={12} weight="light" />
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
                                    className="h-11 rounded-xl border-white/10 bg-white/[0.04] font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-white/25"
                                />
                                {CREDENTIAL_HINTS[provider] ? (
                                    <p className="text-[11px] leading-relaxed text-zinc-500">
                                        Paste JSON credentials:{" "}
                                        <code className="rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                                            {CREDENTIAL_HINTS[provider]}
                                        </code>
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor="setup-base-url"
                                className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500"
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
                                className="h-11 rounded-xl border-white/10 bg-white/[0.04] font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-white/25"
                            />
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            disabled={!keyReady || testing}
                            onClick={runTest}
                            className="h-11 rounded-xl border-white/12 bg-white/[0.04] text-zinc-100 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
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
                            <p className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs leading-relaxed text-red-300">
                                <XCircle size={14} className="mt-0.5 shrink-0" weight="fill" />
                                <span className="whitespace-pre-wrap">{error}</span>
                            </p>
                        ) : null}

                        {verified ? (
                            <div className="flex flex-col gap-2.5 animate-slide-up">
                                <label
                                    htmlFor="setup-model"
                                    className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500"
                                >
                                    Model
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] normal-case tracking-normal text-emerald-300">
                                        <CheckCircle size={11} weight="fill" />
                                        Verified
                                    </span>
                                </label>
                                <SearchableModelSelect
                                    models={models}
                                    value={model}
                                    onChange={setModel}
                                />
                                <p className="text-xs text-zinc-400">
                                    Live test succeeded — choose a model to continue.
                                </p>
                            </div>
                        ) : (
                            <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
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
                            className={cn(
                                "h-12 w-full rounded-full text-sm font-semibold shadow-none transition-[transform,background-color,opacity] active:scale-[0.98]",
                                canContinue
                                    ? "bg-white text-black hover:bg-zinc-100"
                                    : "bg-white/15 text-zinc-400",
                            )}
                        >
                            Continue to chat
                            <ArrowRight data-icon="inline-end" weight="bold" />
                        </Button>
                    </div>
                </section>

                <p className="text-center font-mono text-[10px] tracking-wide text-zinc-600">
                    No server-side LLM credentials · MIT open source
                </p>
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
                "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition-[background-color,border-color,color,transform,box-shadow] active:scale-[0.97]",
                active
                    ? "border-white/20 bg-white text-black shadow-[0_8px_24px_-12px_rgba(255,255,255,0.55)]"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-zinc-100",
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
