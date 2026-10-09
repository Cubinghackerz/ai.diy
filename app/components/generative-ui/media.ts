"use client";

import { createContext, useContext } from "react";

/**
 * Single gate for every third-party request made by generative-UI components
 * (Wikipedia summaries, Wikimedia images, OpenFreeMap tiles). Fails closed:
 * outside the provider no external request is allowed.
 */
export const ExternalMediaContext = createContext(false);

export function useExternalMedia(): boolean {
    return useContext(ExternalMediaContext);
}
