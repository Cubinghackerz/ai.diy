import { useCallback, useEffect, useState } from "react";
import {
    ArrowUp,
    DownloadSimple,
    FolderPlus,
    PencilSimple,
    Trash,
    UploadSimple,
} from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { CodeEditor } from "~/components/computer/CodeEditor";
import {
    joinScopePath,
    listDirectory,
    mkdir,
    readFileBytes,
    readTextFile,
    removePath,
    renamePath,
    writeFile,
    workspaceHome,
    type ComputerFsEntry,
} from "~/lib/computer/fs";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

export function FilesTab({
    scopeId,
    onOpenPath,
}: {
    scopeId: string;
    onOpenPath?: (path: string) => void;
}) {
    const [cwd, setCwd] = useState(workspaceHome());
    const [entries, setEntries] = useState<ComputerFsEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [preview, setPreview] = useState<string>("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);

    const refresh = useCallback(async () => {
        setBusy(true);
        const result = await listDirectory(scopeId, cwd);
        setBusy(false);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        setError(null);
        setEntries(result.data);
    }, [cwd, scopeId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        return () => {
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [imageUrl]);

    const openEntry = async (entry: ComputerFsEntry) => {
        const next = joinScopePath(cwd, entry.name);
        if (entry.dir) {
            setCwd(next);
            setSelected(null);
            setPreview("");
            setEditing(false);
            return;
        }
        setSelected(next);
        onOpenPath?.(next);
        if (IMAGE_EXT.test(entry.name)) {
            const file = await readFileBytes(scopeId, next);
            if (!file.ok) {
                setError(file.error);
                return;
            }
            const blob = new Blob([file.data.bytes.slice()]);
            setImageUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return URL.createObjectURL(blob);
            });
            setPreview("");
            setEditing(false);
            return;
        }
        const text = await readTextFile(scopeId, next);
        if (!text.ok) {
            setError(text.error);
            return;
        }
        setImageUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return null;
        });
        setPreview(text.data);
        setEditing(false);
    };

    const parent = cwd.replace(/\/[^/]+$/, "") || "/";

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
                <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setCwd(parent)}
                    disabled={cwd === "/"}
                    aria-label="Up one folder"
                >
                    <ArrowUp size={14} />
                </button>
                <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                    {cwd}
                </p>
                <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                    title="New folder"
                    onClick={async () => {
                        const name = window.prompt("Folder name");
                        if (!name) return;
                        const result = await mkdir(scopeId, joinScopePath(cwd, name));
                        if (!result.ok) setError(result.error);
                        else void refresh();
                    }}
                >
                    <FolderPlus size={14} />
                </button>
                <label className="rounded-md p-1 text-muted-foreground hover:bg-accent">
                    <UploadSimple size={14} />
                    <input
                        type="file"
                        className="sr-only"
                        onChange={async (event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (!file) return;
                            const bytes = new Uint8Array(await file.arrayBuffer());
                            const result = await writeFile(
                                scopeId,
                                joinScopePath(cwd, file.name),
                                bytes,
                            );
                            if (!result.ok) setError(result.error);
                            else void refresh();
                        }}
                    />
                </label>
            </div>
            {error ? (
                <p className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                    {error}
                </p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {busy && entries.length === 0 ? (
                    <p className="px-3 py-4 text-[11px] text-muted-foreground">Loading…</p>
                ) : (
                    <ul>
                        {entries.map((entry) => (
                            <li key={entry.name}>
                                <button
                                    type="button"
                                    onClick={() => void openEntry(entry)}
                                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                                >
                                    <span className="truncate">
                                        {entry.dir ? "▸ " : ""}
                                        {entry.name}
                                    </span>
                                    {!entry.dir ? (
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                            {entry.size}
                                        </span>
                                    ) : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {selected ? (
                <div className="flex max-h-[45%] min-h-32 flex-col border-t border-border">
                    <div className="flex items-center gap-1 border-b border-border px-2 py-1">
                        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                            {selected}
                        </span>
                        <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-accent"
                            title="Rename"
                            onClick={async () => {
                                const name = window.prompt("New name", selected.split("/").pop());
                                if (!name) return;
                                const next = joinScopePath(cwd, name);
                                const result = await renamePath(scopeId, selected, next);
                                if (!result.ok) setError(result.error);
                                else {
                                    setSelected(next);
                                    void refresh();
                                }
                            }}
                        >
                            <PencilSimple size={13} />
                        </button>
                        <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-accent"
                            title="Download"
                            onClick={async () => {
                                const file = await readFileBytes(scopeId, selected);
                                if (!file.ok) {
                                    setError(file.error);
                                    return;
                                }
                                const url = URL.createObjectURL(new Blob([file.data.bytes.slice()]));
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = file.data.name;
                                link.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            <DownloadSimple size={13} />
                        </button>
                        <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-accent"
                            title="Delete"
                            onClick={async () => {
                                if (!window.confirm(`Delete ${selected}?`)) return;
                                const result = await removePath(scopeId, selected);
                                if (!result.ok) setError(result.error);
                                else {
                                    setSelected(null);
                                    setPreview("");
                                    void refresh();
                                }
                            }}
                        >
                            <Trash size={13} />
                        </button>
                        {!imageUrl ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                    if (!editing) {
                                        setEditing(true);
                                        return;
                                    }
                                    const result = await writeFile(
                                        scopeId,
                                        selected,
                                        new TextEncoder().encode(preview),
                                    );
                                    if (!result.ok) setError(result.error);
                                    else setEditing(false);
                                }}
                            >
                                {editing ? "Save" : "Edit"}
                            </Button>
                        ) : null}
                    </div>
                    {imageUrl ? (
                        <img src={imageUrl} alt="" className="max-h-48 object-contain p-2" />
                    ) : editing ? (
                        <CodeEditor
                            value={preview}
                            onChange={setPreview}
                            filename={selected}
                        />
                    ) : (
                        <pre className="overflow-auto p-3 font-mono text-[11px] leading-relaxed">
                            {preview || "(empty)"}
                        </pre>
                    )}
                </div>
            ) : null}
        </div>
    );
}