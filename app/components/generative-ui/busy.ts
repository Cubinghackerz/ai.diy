"use client";

import { createContext, useContext } from "react";

/**
 * True while the thread is generating. Card actions (follow-up chips, "Add"
 * buttons) append user messages directly, bypassing the composer's own
 * send lock, so they consult this instead. Outside a provider it is false.
 */
export const ThreadBusyContext = createContext(false);

export function useThreadBusy(): boolean {
    return useContext(ThreadBusyContext);
}
