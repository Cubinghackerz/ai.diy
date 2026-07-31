/**
 * RuntimeSync — force React (incl. React Compiler memo) to re-render when the
 * underlying assistant-ui thread/composer runtime notifies.
 *
 * Important: Context consumers (and anything that reads `useRuntimeSyncTick`)
 * must opt in. Parent re-renders alone do not refresh memoized / same-element
 * children under the Provider.
 */

import { useAui } from "@assistant-ui/react";
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

const RuntimeSyncContext = createContext(0);

/** Read inside trees that must re-render when the runtime ticks. */
export function useRuntimeSyncTick() {
    return useContext(RuntimeSyncContext);
}

export function RuntimeSync({ children }: { children: ReactNode }) {
    const aui = useAui();
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const bump = () => setTick((t) => (t + 1) % 1_000_000);

        const unsubs: Array<() => void> = [];
        const threadRuntime = aui.thread.__internal_getRuntime?.();
        const composerRuntime = aui.composer.__internal_getRuntime?.();

        if (threadRuntime?.subscribe) unsubs.push(threadRuntime.subscribe(bump));
        if (composerRuntime?.subscribe)
            unsubs.push(composerRuntime.subscribe(bump));
        unsubs.push(aui.subscribe(bump));

        for (const event of [
            "thread.runStart",
            "thread.runEnd",
            "composer.send",
        ] as const) {
            try {
                unsubs.push(aui.on(event, bump));
            } catch {
                // Event may be unavailable depending on runtime version.
            }
        }

        return () => {
            for (const u of unsubs) u();
        };
    }, [aui]);

    return (
        <RuntimeSyncContext.Provider value={tick}>
            {children}
        </RuntimeSyncContext.Provider>
    );
}
