/**
 * Which sidebar panel is active ("settings" shows the Settings dialog).
 *
 * This lives outside React state on purpose. It used to be `useState` in the
 * workspace route, so opening Settings re-rendered the whole shell (thread,
 * runtime provider, canvas, composer) just to toggle a dialog. Components that
 * need it subscribe here and nothing else re-renders.
 */

import { useSyncExternalStore } from "react";

export type SidebarPanel = "chats" | "settings";

let panel: SidebarPanel = "chats";
const listeners = new Set<() => void>();

export function getSidebarPanel(): SidebarPanel {
    return panel;
}

export function setSidebarPanel(next: SidebarPanel): void {
    if (next === panel) return;
    panel = next;
    for (const listener of [...listeners]) listener();
}

export function subscribeSidebarPanel(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const SERVER_PANEL: SidebarPanel = "chats";

export function useSidebarPanel(): SidebarPanel {
    return useSyncExternalStore(subscribeSidebarPanel, getSidebarPanel, () => SERVER_PANEL);
}
