/**
 * Canvas Store — Shared state for the artifact/canvas side panel
 * 
 * Artifacts can be: html_preview | python_output | code | file_download
 */

import {
    useCallback,
    useMemo,
    useState,
    createContext,
    useContext,
    type ReactNode,
} from "react";

export type ArtifactKind = "html" | "python" | "code" | "file";

export interface Artifact {
    id: string;
    kind: ArtifactKind;
    title: string;
    language?: string;
    content: string;       // code/HTML/text content
    output?: string;       // execution output (for python)
    mimeType?: string;     // for file downloads
    filename?: string;     // for file downloads
    createdAt: number;
}

interface CanvasContextValue {
    artifacts: Artifact[];
    activeArtifactId: string | null;
    canvasOpen: boolean;
    canvasWidth: number;
    setCanvasWidth: (w: number) => void;
    addArtifact: (a: Omit<Artifact, "id" | "createdAt">) => string;
    updateArtifactOutput: (id: string, output: string) => void;
    setActiveArtifactId: (id: string | null) => void;
    openCanvas: () => void;
    closeCanvas: () => void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

const MIN_WIDTH = 320;
const MAX_WIDTH_RATIO = 0.5;

function viewportWidth() {
    return typeof window !== "undefined" ? window.innerWidth : 1280;
}

function clampCanvasWidth(width: number, viewport = viewportWidth()) {
    const maxWidth = Math.round(viewport * MAX_WIDTH_RATIO);
    const minWidth = Math.min(MIN_WIDTH, maxWidth);
    return Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
}

function recommendedCanvasWidth(artifact: Omit<Artifact, "id" | "createdAt">) {
    const viewport = viewportWidth();
    const maxWidth = Math.round(viewport * MAX_WIDTH_RATIO);
    const minWidth = Math.min(MIN_WIDTH, maxWidth);
    const longestLine = Math.max(
        0,
        ...artifact.content.split("\n").map((line) => line.length),
    );
    const complexity = Math.min(1, longestLine / 140);

    // Interactive previews need the most room. Code and data get a compact
    // split unless long lines make a wider editor materially more useful.
    const ratio =
        artifact.kind === "html"
            ? MAX_WIDTH_RATIO
            : artifact.kind === "python"
              ? 0.4 + complexity * 0.1
              : 0.34 + complexity * 0.16;

    return Math.max(minWidth, Math.min(maxWidth, Math.round(viewport * ratio)));
}

export function CanvasProvider({ children }: { children: ReactNode }) {
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
    const [canvasOpen, setCanvasOpen] = useState(false);
    const [canvasWidth, setCanvasWidth] = useState(() => {
        const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
        return Math.round(vw * MAX_WIDTH_RATIO);
    });

    const setCanvasWidthClamped = useCallback((w: number) => {
        setCanvasWidth(clampCanvasWidth(w));
    }, []);

    const addArtifact = useCallback((a: Omit<Artifact, "id" | "createdAt">) => {
        const createdAt = Date.now();
        const newArtifact: Artifact = {
            ...a,
            id: `artifact_${createdAt}`,
            createdAt,
        };
        setArtifacts((prev) => [...prev, newArtifact]);
        setActiveArtifactId(newArtifact.id);
        setCanvasWidth(recommendedCanvasWidth(a));
        setCanvasOpen(true);
        return newArtifact.id;
    }, []);

    const updateArtifactOutput = useCallback((id: string, output: string) => {
        setArtifacts((prev) =>
            prev.map((a) => (a.id === id ? { ...a, output } : a))
        );
    }, []);

    const openCanvas = useCallback(() => setCanvasOpen(true), []);
    const closeCanvas = useCallback(() => setCanvasOpen(false), []);

    const contextValue = useMemo<CanvasContextValue>(
        () => ({
            artifacts,
            activeArtifactId,
            canvasOpen,
            canvasWidth,
            setCanvasWidth: setCanvasWidthClamped,
            addArtifact,
            updateArtifactOutput,
            setActiveArtifactId,
            openCanvas,
            closeCanvas,
        }),
        [
            artifacts,
            activeArtifactId,
            canvasOpen,
            canvasWidth,
            setCanvasWidthClamped,
            addArtifact,
            updateArtifactOutput,
            openCanvas,
            closeCanvas,
        ],
    );

    return (
        <CanvasContext.Provider value={contextValue}>
            {children}
        </CanvasContext.Provider>
    );
}

export function useCanvas() {
    const ctx = useContext(CanvasContext);
    if (!ctx) throw new Error("useCanvas must be used within CanvasProvider");
    return ctx;
}
