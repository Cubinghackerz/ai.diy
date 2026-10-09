"use client";

import { useEffect, useState } from "react";
import { decodeArtifactContent, inferArtifactMimeType } from "~/lib/artifacts";
import { useOptionalCanvas, type Artifact } from "~/lib/canvas";

const SAFE_IMAGE_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
]);

/**
 * Finds the newest image artifact (for example a matplotlib `savefig` from
 * run_python) by filename. Only raster formats and SVG are accepted; SVG is
 * shown through <img>, which never runs scripts.
 */
export function findImageArtifact(
    artifacts: readonly Artifact[],
    filename: string | undefined,
): Artifact | null {
    if (!filename) return null;
    const wanted = filename.replace(/[\\/]/g, "_").trim();
    for (let index = artifacts.length - 1; index >= 0; index--) {
        const artifact = artifacts[index];
        if (artifact.filename !== wanted) continue;
        const mime = (artifact.mimeType || inferArtifactMimeType(wanted)).toLowerCase();
        if (SAFE_IMAGE_TYPES.has(mime)) return artifact;
    }
    return null;
}

/** Local object URL for a Python-generated image, or null while missing. No network involved. */
export function usePythonImage(filename: string | undefined): string | null {
    const canvas = useOptionalCanvas();
    const artifact = findImageArtifact(canvas?.artifacts ?? [], filename);
    const [url, setUrl] = useState<string | null>(null);
    const id = artifact?.id;
    const content = artifact?.content;
    const encoding = artifact?.contentEncoding;
    const mime = artifact
        ? (artifact.mimeType || inferArtifactMimeType(artifact.filename ?? "")).toLowerCase()
        : "";

    useEffect(() => {
        if (!id || content === undefined) {
            setUrl(null);
            return;
        }
        const bytes = encoding ? decodeArtifactContent(content, encoding) : null;
        if (encoding && !bytes) {
            setUrl(null);
            return;
        }
        const blob = new Blob([bytes ?? content], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [id, content, encoding, mime]);

    return url;
}
