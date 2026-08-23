/**
 * Computer Mode command/process log — per-scope persistence in localStorage.
 */

export type ComputerHistoryEntry = {
    at: number;
    command: string;
    output: string;
    exitCode: number | null;
};

const HISTORY_LIMIT = 100;

export function historyKey(scopeId: string): string {
    return `aidiy:computer-history:${scopeId}`;
}

export function loadHistory(scopeId: string): ComputerHistoryEntry[] {
    try {
        const raw = localStorage.getItem(historyKey(scopeId));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item): item is ComputerHistoryEntry =>
                Boolean(item) &&
                typeof (item as ComputerHistoryEntry).command === "string",
            )
            .sort((a, b) => b.at - a.at)
            .slice(0, HISTORY_LIMIT);
    } catch {
        return [];
    }
}

export function appendHistory(
    scopeId: string,
    entry: Omit<ComputerHistoryEntry, "at">,
): void {
    try {
        const existing = loadHistory(scopeId);
        existing.unshift({ ...entry, at: Date.now() });
        localStorage.setItem(
            historyKey(scopeId),
            JSON.stringify(existing.slice(0, HISTORY_LIMIT)),
        );
    } catch {
        // Storage is best-effort; failures never block the terminal.
    }
}

export function clearHistory(scopeId: string): void {
    try {
        localStorage.removeItem(historyKey(scopeId));
    } catch {
        // ignore
    }
}