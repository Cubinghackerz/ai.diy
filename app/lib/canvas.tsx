/**
 * Canvas Store — Shared state for the artifact/canvas side panel
 * 
 * Artifacts can be: html_preview | python_output | code | file_download
 */

import { useState, createContext, useContext, type ReactNode } from "react";

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
    addArtifact: (a: Omit<Artifact, "id" | "createdAt">) => void;
    updateArtifactOutput: (id: string, output: string) => void;
    setActiveArtifactId: (id: string | null) => void;
    openCanvas: () => void;
    closeCanvas: () => void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
    const [canvasOpen, setCanvasOpen] = useState(false);

    const addArtifact = (a: Omit<Artifact, "id" | "createdAt">) => {
        const newArtifact: Artifact = {
            ...a,
            id: `artifact_${Date.now()}`,
            createdAt: Date.now(),
        };
        setArtifacts((prev) => [...prev, newArtifact]);
        setActiveArtifactId(newArtifact.id);
        setCanvasOpen(true);
        return newArtifact.id;
    };

    const updateArtifactOutput = (id: string, output: string) => {
        setArtifacts((prev) =>
            prev.map((a) => (a.id === id ? { ...a, output } : a))
        );
    };

    return (
        <CanvasContext.Provider
            value={{
                artifacts,
                activeArtifactId,
                canvasOpen,
                addArtifact,
                updateArtifactOutput,
                setActiveArtifactId,
                openCanvas: () => setCanvasOpen(true),
                closeCanvas: () => setCanvasOpen(false),
            }}
        >
            {children}
        </CanvasContext.Provider>
    );
}

export function useCanvas() {
    const ctx = useContext(CanvasContext);
    if (!ctx) throw new Error("useCanvas must be used within CanvasProvider");
    return ctx;
}
