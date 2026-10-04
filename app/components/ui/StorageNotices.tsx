import { useEffect, useState, useSyncExternalStore } from "react";
import {
    clearStorageIssue,
    getServerStorageIssues,
    getStorageIssues,
    reportStorageFailure,
    requestPersistentStorage,
    subscribeStorageIssues,
} from "~/lib/storage-notices";

function useIssues() {
    return useSyncExternalStore(subscribeStorageIssues, getStorageIssues, getServerStorageIssues);
}

export function PersistenceBanner() {
    const issues = useIssues();
    const [busy, setBusy] = useState(false);
    if (!issues.length) return null;
    return (
        <div
            role="alert"
            aria-label="Storage warning"
            className="shrink-0 border-b border-destructive/40 bg-background px-4 py-3 text-sm"
        >
            {issues.map((issue) => (
                <div key={issue.id} className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 flex-1">{issue.message}</p>
                    {issue.exportData ? (
                        <button
                            type="button"
                            className="min-h-11 rounded-md border border-border px-3 hover:bg-accent focus-visible:outline-2"
                            onClick={issue.exportData}
                        >
                            Download unsaved chat
                        </button>
                    ) : null}
                    {issue.retry ? (
                        <button
                            type="button"
                            disabled={busy}
                            className="min-h-11 rounded-md border border-border px-3 hover:bg-accent focus-visible:outline-2 disabled:opacity-50"
                            onClick={async () => {
                                setBusy(true);
                                try {
                                    await issue.retry?.();
                                    if (
                                        getStorageIssues().find(
                                            (current) => current.id === issue.id,
                                        ) === issue
                                    )
                                        clearStorageIssue(issue.id);
                                } catch (error) {
                                    reportStorageFailure(
                                        issue.id,
                                        issue.resource,
                                        error,
                                        issue.retry,
                                        issue.exportData,
                                    );
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            {busy ? "Retrying…" : `Retry saving ${issue.resource.toLowerCase()}`}
                        </button>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

export function PersistenceToast() {
    const issues = useIssues();
    const latest = issues.at(-1);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (!latest) return;
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 6_000);
        return () => clearTimeout(timer);
    }, [latest]);
    if (!latest || !visible) return null;
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed right-4 bottom-4 z-[100] max-w-sm rounded-md border border-destructive/40 bg-background p-4 text-sm shadow-lg"
        >
            {latest.message}
        </div>
    );
}

export function StorageHealthPanel() {
    const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
    const [persistent, setPersistent] = useState(false);
    const [status, setStatus] = useState("Loading storage details…");
    const [busy, setBusy] = useState(false);
    const refresh = async () => {
        try {
            if (!navigator.storage?.estimate) {
                setStatus("Storage estimates are unavailable in this browser.");
                return;
            }
            const [next, protectedStorage] = await Promise.all([
                navigator.storage.estimate(),
                navigator.storage.persisted?.() ?? false,
            ]);
            setEstimate(next);
            setPersistent(protectedStorage);
            setStatus("");
        } catch {
            setStatus("Storage details couldn’t be read. Your data was not changed.");
        }
    };
    useEffect(() => {
        void refresh();
    }, []);
    const bytes = (value?: number) =>
        value == null ? "Unknown" : `${(value / 1024 / 1024).toFixed(1)} MiB`;
    return (
        <section
            aria-label="Browser storage"
            className="rounded-md border border-border p-3 text-sm"
        >
            <h4 className="font-medium">Browser storage</h4>
            <p className="mt-1 text-muted-foreground">
                Estimates cover this site’s storage. Persistent storage reduces automatic eviction;
                it is not a backup.
            </p>
            {estimate ? (
                <dl className="my-3 grid grid-cols-2 gap-2">
                    <dt>Used</dt>
                    <dd>{bytes(estimate.usage)}</dd>
                    <dt>Quota</dt>
                    <dd>{bytes(estimate.quota)}</dd>
                    <dt>Persistence</dt>
                    <dd>{persistent ? "Protected from automatic eviction" : "Best effort"}</dd>
                </dl>
            ) : null}
            <p role="status">{status}</p>
            <div className="mt-2 flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 rounded-md border border-border px-3 hover:bg-accent focus-visible:outline-2"
                    onClick={() => void refresh()}
                >
                    Refresh storage details
                </button>
                {!persistent ? (
                    <button
                        type="button"
                        disabled={busy}
                        className="min-h-11 rounded-md border border-border px-3 hover:bg-accent focus-visible:outline-2"
                        onClick={async () => {
                            setBusy(true);
                            const granted = await requestPersistentStorage(true);
                            await refresh();
                            setStatus(
                                granted
                                    ? "Persistent storage enabled."
                                    : "This browser did not grant persistent storage. Export backups regularly.",
                            );
                            setBusy(false);
                        }}
                    >
                        Request persistent storage
                    </button>
                ) : null}
            </div>
        </section>
    );
}
