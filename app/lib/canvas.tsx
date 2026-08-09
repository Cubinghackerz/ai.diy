/**
 * Canvas Store — Shared state for the artifact/canvas side panel
 * 
 * Artifacts can be: html_preview | python_output | code | file_download
 */

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    createContext,
    useContext,
    type ReactNode,
} from "react";
import type { ArtifactContentEncoding } from "~/lib/artifacts";

export type ArtifactKind = "html" | "python" | "code" | "file";

export interface Artifact {
    id: string;
    kind: ArtifactKind;
    title: string;
    language?: string;
    content: string;       // code/HTML/text content, or encoded binary data
    output?: string;       // execution output (for python)
    mimeType?: string;     // for file downloads
    contentEncoding?: ArtifactContentEncoding;
    filename?: string;     // for file downloads
    /** Stable content identity used to reopen, not duplicate, an artifact. */
    sourceKey?: string;
    /** Thread or preview run that produced this artifact. */
    scopeId?: string | null;
    createdAt: number;
}

interface CanvasContextValue {
    artifacts: Artifact[];
    activeArtifactId: string | null;
    canvasOpen: boolean;
    canvasWidth: number;
    setCanvasWidth: (w: number) => void;
    addArtifact: (
        a: Omit<Artifact, "id" | "createdAt" | "scopeId" | "sourceKey"> & {
            sourceKey?: string;
        },
        options?: { open?: boolean; scopeId?: string | null },
    ) => string;
    updateArtifactOutput: (id: string, output: string) => void;
    setActiveArtifactId: (id: string | null) => void;
    setArtifactScope: (scopeId: string | null) => void;
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

function isImageLikeArtifact(artifact: Omit<Artifact, "id" | "createdAt">) {
    if (artifact.mimeType && /^image\//i.test(artifact.mimeType)) return true;
    return Boolean(artifact.filename?.match(/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i));
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

    // Interactive previews and images need the most room. Code and data get a
    // compact split unless long lines make a wider editor materially more useful.
    const ratio =
        artifact.kind === "html" || isImageLikeArtifact(artifact)
            ? MAX_WIDTH_RATIO
            : artifact.kind === "python"
              ? 0.4 + complexity * 0.1
              : 0.34 + complexity * 0.16;

    return Math.max(minWidth, Math.min(maxWidth, Math.round(viewport * ratio)));
}

export function CanvasProvider({ children }: { children: ReactNode }) {
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const artifactsRef = useRef<Artifact[]>([]);
    const artifactScopeRef = useRef<string | null>(null);
    const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
    const [canvasOpen, setCanvasOpen] = useState(false);
    const [canvasWidth, setCanvasWidth] = useState(() => {
        const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
        return Math.round(vw * MAX_WIDTH_RATIO);
    });

    const setCanvasWidthClamped = useCallback((w: number) => {
        setCanvasWidth(clampCanvasWidth(w));
    }, []);

    useEffect(() => {
        const onResize = () => {
            setCanvasWidth((width) => clampCanvasWidth(width));
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const setArtifactScope = useCallback((scopeId: string | null) => {
        if (artifactScopeRef.current === scopeId) return;
        artifactScopeRef.current = scopeId;
        artifactsRef.current = [];
        setArtifacts([]);
        setActiveArtifactId(null);
        setCanvasOpen(false);
    }, []);

    const addArtifact = useCallback((
        a: Omit<Artifact, "id" | "createdAt" | "scopeId" | "sourceKey"> & {
            sourceKey?: string;
        },
        options?: { open?: boolean; scopeId?: string | null },
    ) => {
        const scopeId = options?.scopeId ?? artifactScopeRef.current;
        const sourceKey =
            a.sourceKey ??
            `${a.kind}:${a.filename ?? a.title}:${a.contentEncoding ?? "text"}:${a.content}`;
        const existing = artifactsRef.current.find(
            (artifact) =>
                artifact.scopeId === scopeId && artifact.sourceKey === sourceKey,
        );
        if (existing) {
            setActiveArtifactId(existing.id);
            if (options?.open !== false) setCanvasOpen(true);
            return existing.id;
        }

        const createdAt = Date.now();
        // Multiple Python/file captures often land in the same millisecond —
        // colliding ids make tab switches highlight every matching tab and
        // `find` always returns the first artifact.
        const id =
            typeof crypto !== "undefined" && "randomUUID" in crypto
                ? `artifact_${crypto.randomUUID()}`
                : `artifact_${createdAt}_${Math.random().toString(36).slice(2, 10)}`;
        const newArtifact: Artifact = {
            ...a,
            id,
            sourceKey,
            scopeId,
            createdAt,
        };
        artifactsRef.current = [...artifactsRef.current, newArtifact];
        setArtifacts(artifactsRef.current);
        setActiveArtifactId(newArtifact.id);
        setCanvasWidth(recommendedCanvasWidth(a));
        if (options?.open !== false) setCanvasOpen(true);
        return newArtifact.id;
    }, []);

    const updateArtifactOutput = useCallback((id: string, output: string) => {
        artifactsRef.current = artifactsRef.current.map((artifact) =>
            artifact.id === id ? { ...artifact, output } : artifact,
        );
        setArtifacts(artifactsRef.current);
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
            setArtifactScope,
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
            setArtifactScope,
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

export function useOptionalCanvas() {
    return useContext(CanvasContext);
}
