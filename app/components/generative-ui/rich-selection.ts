"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny shared store so a RichTimeline and RichMap that show the same items
 * highlight the same entry. Scoped by the item ids so unrelated responses do
 * not interfere.
 */
const selected = new Map<string, number | null>();
const listeners = new Set<() => void>();
const MAX_SCOPES = 100;

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useRichSelection(scope: string): [number | null, (index: number | null) => void] {
    const value = useSyncExternalStore(
        subscribe,
        () => selected.get(scope) ?? null,
        () => null,
    );
    const select = useCallback(
        (index: number | null) => {
            if (selected.size >= MAX_SCOPES && !selected.has(scope)) {
                selected.delete(selected.keys().next().value as string);
            }
            selected.set(scope, index);
            for (const listener of listeners) listener();
        },
        [scope],
    );
    return [value, select];
}
