import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Local draft for a text field that is saved to global settings.
 *
 * Writing settings on every keystroke re-renders everything that reads them
 * (the composer, the model controls, the chat runtime) and queues an encrypted
 * save each time, so typing in Settings lagged. The draft keeps typing local and
 * commits once: after a short pause, on blur, when the field unmounts (switching
 * sections or closing Settings), and when the page is hidden. The committed value
 * flows back in unless the user has unsaved edits, so a reset or an import still
 * updates the field.
 */
export function useDraftSetting(committed: string, commit: (value: string) => void, delayMs = 400) {
    const [draft, setDraft] = useState(committed);
    const draftRef = useRef(committed);
    const dirty = useRef(false);
    const timer = useRef<number | undefined>(undefined);
    const commitRef = useRef(commit);
    commitRef.current = commit;

    useEffect(() => {
        if (dirty.current) return;
        draftRef.current = committed;
        setDraft(committed);
    }, [committed]);

    const flush = useCallback(() => {
        window.clearTimeout(timer.current);
        if (!dirty.current) return;
        dirty.current = false;
        commitRef.current(draftRef.current);
    }, []);

    /** Replace the field and save straight away (Clear / Restore buttons). */
    const commitNow = useCallback((next: string) => {
        window.clearTimeout(timer.current);
        dirty.current = false;
        draftRef.current = next;
        setDraft(next);
        commitRef.current(next);
    }, []);

    const onChange = useCallback(
        (next: string) => {
            draftRef.current = next;
            dirty.current = true;
            setDraft(next);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(flush, delayMs);
        },
        [delayMs, flush],
    );

    useEffect(() => {
        const onHide = () => flush();
        window.addEventListener("pagehide", onHide);
        document.addEventListener("visibilitychange", onHide);
        return () => {
            window.removeEventListener("pagehide", onHide);
            document.removeEventListener("visibilitychange", onHide);
            flush();
        };
    }, [flush]);

    return { value: draft, onChange, flush, commitNow };
}
