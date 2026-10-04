export type StorageResource =
    "Chat" | "Chat history" | "Artifact" | "Settings" | "Settings backup" | "Local storage";
export interface StorageIssue {
    id: string;
    resource: StorageResource;
    message: string;
    retry?: () => Promise<unknown>;
    exportData?: () => void;
}

const empty: readonly StorageIssue[] = [];
let issues: readonly StorageIssue[] = empty;
const listeners = new Set<() => void>();

export function subscribeStorageIssues(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export const getStorageIssues = () => issues;
export const getServerStorageIssues = () => empty;

function publish(next: readonly StorageIssue[]) {
    issues = next;
    for (const listener of listeners) listener();
}

export function clearStorageIssue(id: string) {
    if (issues.some((issue) => issue.id === id)) publish(issues.filter((issue) => issue.id !== id));
}

export function reportStorageFailure(
    id: string,
    resource: StorageResource,
    error: unknown,
    retry?: () => Promise<unknown>,
    exportData?: () => void,
) {
    if (typeof window === "undefined") return;
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    const message =
        name === "QuotaExceededError"
            ? `${resource} couldn’t be saved — browser storage is full. Keep this tab open and export your data before freeing space.`
            : name === "VersionError"
              ? "This browser contains a newer ai.diy database. Use the matching app version or export a backup; do not clear site data."
              : name === "ArtifactTooLarge"
                ? "This artifact is too large to save locally. It is still available in Canvas; download it before closing this tab."
                : name === "SettingsRecoveryError"
                  ? "Stored settings couldn’t be unlocked. The original data is untouched; restore a backup or retry."
                  : `${resource} couldn’t be stored or loaded. Your current in-memory data is retained. Keep this tab open and retry or export it.`;
    publish([
        ...issues.filter((issue) => issue.id !== id && issue.id !== `database-write:${resource}`),
        { id, resource, message, retry, exportData },
    ]);
}

export async function observeStorage<T>(
    id: string,
    resource: StorageResource,
    operation: () => Promise<T>,
    exportData?: () => void,
): Promise<T> {
    const previousIssue = issues.find((issue) => issue.id === id);
    try {
        const result = await operation();
        if (issues.find((issue) => issue.id === id) === previousIssue) clearStorageIssue(id);
        return result;
    } catch (error) {
        reportStorageFailure(
            id,
            resource,
            error,
            () => observeStorage(id, resource, operation, exportData),
            exportData,
        );
        throw error;
    }
}

let pendingPersistence: Promise<boolean> | null = null;

export function requestPersistentStorage(force = false): Promise<boolean> {
    if (pendingPersistence) return pendingPersistence;
    if (typeof navigator === "undefined" || !navigator.storage?.persist)
        return Promise.resolve(false);
    const request = (async () => {
        try {
            const key = "prismium-lite:storage-persistence-requested";
            if (!force && localStorage.getItem(key)) return await navigator.storage.persisted();
            const granted = await navigator.storage.persist();
            localStorage.setItem(key, "true");
            return granted;
        } catch {
            return false;
        }
    })();
    pendingPersistence = request;
    void request.finally(() => {
        if (pendingPersistence === request) pendingPersistence = null;
    });
    return request;
}
