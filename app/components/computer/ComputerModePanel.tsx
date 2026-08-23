import { useState } from "react";
import { Desktop, X } from "@phosphor-icons/react";
import { FilesTab } from "~/components/computer/FilesTab";
import { TerminalTab } from "~/components/computer/TerminalTab";
import { AiHelperTab } from "~/components/computer/AiHelperTab";
import { OutputsTab } from "~/components/computer/OutputsTab";
import { useSettings } from "~/lib/providers/SettingsProvider";
import { cn } from "~/lib/utils";

const TABS = ["Files", "Terminal", "AI helper", "Outputs"] as const;

export function ComputerModePanel({ scopeId }: { scopeId: string }) {
    const { settings, updateSettings } = useSettings();
    const [tab, setTab] = useState<(typeof TABS)[number]>("Files");
    const [selectedPath, setSelectedPath] = useState<string | null>(null);

    if (!settings.computerModeEnabled) return null;

    return (
        <aside
            className="relative z-30 flex h-full w-[min(28rem,46vw)] shrink-0 flex-col overflow-hidden border-l border-border bg-card"
            aria-label="Computer Mode"
        >
            <div className="flex h-12 items-center justify-between border-b border-border px-3">
                <div className="flex items-center gap-2">
                    <Desktop size={15} className="text-muted-foreground" />
                    <span className="text-sm font-semibold">Computer</span>
                </div>
                <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => updateSettings({ computerModeEnabled: false })}
                    aria-label="Close Computer Mode"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="flex gap-1 border-b border-border px-2 py-1.5">
                {TABS.map((item) => (
                    <button
                        key={item}
                        type="button"
                        onClick={() => setTab(item)}
                        className={cn(
                            "rounded-md px-2 py-1 text-[11px]",
                            tab === item ? "bg-accent text-foreground" : "text-muted-foreground",
                        )}
                    >
                        {item}
                    </button>
                ))}
            </div>
            {tab === "Files" ? (
                <FilesTab scopeId={scopeId} onOpenPath={setSelectedPath} />
            ) : null}
            {tab === "Terminal" ? <TerminalTab scopeId={scopeId} /> : null}
            {tab === "AI helper" ? (
                <AiHelperTab scopeId={scopeId} selectedPath={selectedPath} />
            ) : null}
            {tab === "Outputs" ? (
                <OutputsTab
                    scopeId={scopeId}
                    onOpen={(name) => {
                        setSelectedPath(`/home/user/${name}`);
                        setTab("Files");
                    }}
                />
            ) : null}
        </aside>
    );
}