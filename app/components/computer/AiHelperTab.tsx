import { useState } from "react";
import { Play } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { executeLinuxClientTool } from "~/lib/cheerpx";
import { appendHistory } from "~/lib/computer/history";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { localProviderKey } from "~/lib/provider-credentials";

export function AiHelperTab({
    scopeId,
    selectedPath,
}: {
    scopeId: string;
    selectedPath: string | null;
}) {
    const { settings } = useSettings();
    const [prompt, setPrompt] = useState("");
    const [mode, setMode] = useState<"command" | "explain" | "fix" | "summarize" | "create">(
        "command",
    );
    const [result, setResult] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ask = async () => {
        const text = prompt.trim();
        if (!text) return;
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/computer/hint", {
                method: "POST",
                headers: { "content-type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    provider: settings.chat.provider,
                    model: settings.chat.model,
                    apiKey:
                        settings.providers[settings.chat.provider]?.apiKey ||
                        localProviderKey(settings.chat.provider),
                    baseUrl: settings.providers[settings.chat.provider]?.baseUrl,
                    mode,
                    prompt: text,
                    path: selectedPath,
                }),
            });
            const data = (await response.json()) as { text?: string; error?: string };
            if (!response.ok || data.error) {
                setError(data.error || "Hint request failed.");
                return;
            }
            setResult(data.text || "");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Hint request failed.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
                One-shot help only. No multi-step planning. Vision-capable models work best when
                inspecting screenshots.
            </p>
            <div className="flex flex-wrap gap-1">
                {(["command", "explain", "fix", "summarize", "create"] as const).map((item) => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => setMode(item)}
                        className={`rounded-md px-2 py-1 text-[11px] ${
                            mode === item ? "bg-accent text-foreground" : "text-muted-foreground"
                        }`}
                    >
                        {item}
                    </button>
                ))}
            </div>
            <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={
                    mode === "command"
                        ? "How do I unzip this archive?"
                        : "Describe the file change you want."
                }
                className="min-h-24 resize-none rounded-lg border border-border bg-transparent p-2 text-xs outline-none"
            />
            <Button type="button" size="sm" disabled={busy} onClick={() => void ask()}>
                {busy ? "Thinking…" : "Ask"}
            </Button>
            {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
            {result ? (
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border p-2">
                    <pre className="whitespace-pre-wrap font-mono text-[11px]">{result}</pre>
                    {mode === "command" ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="mt-2"
                            onClick={async () => {
                                const command = result.trim().split("\n")[0]?.replace(/^`+|`+$/g, "") ?? "";
                                if (!command) return;
                                if (
                                    /rm\s+-rf\s+[\/~]|mkfs/.test(command) &&
                                    !window.confirm(`Run destructive command?\n${command}`)
                                ) {
                                    return;
                                }
                                const ran = await executeLinuxClientTool(
                                    "linux_run_command",
                                    { command },
                                    scopeId,
                                );
                                appendHistory(scopeId, {
                                    command,
                                    output: ran.output.slice(0, 4000),
                                    exitCode: /error|timed out/i.test(ran.output) ? 1 : 0,
                                });
                            }}
                        >
                            <Play size={12} /> Run command
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}