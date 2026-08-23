import { useEffect, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { recentFiles, readFileBytes, type ComputerFsEntry } from "~/lib/computer/fs";

export function OutputsTab({
    scopeId,
    onOpen,
}: {
    scopeId: string;
    onOpen: (name: string) => void;
}) {
    const [entries, setEntries] = useState<ComputerFsEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void recentFiles(scopeId).then((result) => {
            if (!result.ok) setError(result.error);
            else setEntries(result.data);
        });
    }, [scopeId]);

    return (
        <div className="min-h-0 flex-1 overflow-auto p-3">
            {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
            {!entries.length && !error ? (
                <p className="text-[11px] text-muted-foreground">
                    Recently created files under /home/user will appear here.
                </p>
            ) : null}
            <ul className="space-y-1">
                {entries.map((entry) => (
                    <li
                        key={`${entry.name}-${entry.mtime}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2"
                    >
                        <button
                            type="button"
                            className="min-w-0 truncate text-left text-xs"
                            onClick={() => onOpen(entry.name)}
                        >
                            {entry.name}
                        </button>
                        <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Download ${entry.name}`}
                            onClick={async () => {
                                const file = await readFileBytes(scopeId, `/home/user/${entry.name}`);
                                if (!file.ok) return;
                                const url = URL.createObjectURL(new Blob([file.data.bytes.slice()]));
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = file.data.name;
                                link.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            <DownloadSimple size={14} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}