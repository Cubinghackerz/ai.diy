/**
 * Persist Canvas artifacts to IndexedDB for the active thread scope.
 * Used for create_file results and Python-captured binaries/images.
 */
import type { Artifact } from "~/lib/canvas";
import { saveArtifactToDB } from "~/lib/db";

const MAX_PERSIST_CHARS = 3_000_000; // ~2 MiB base64 + margin

export function persistArtifactForScope(
    scopeId: string | null | undefined,
    artifact: Artifact,
): void {
    if (!scopeId) return;
    if (artifact.content.length > MAX_PERSIST_CHARS) return;
    void saveArtifactToDB(scopeId, { ...artifact, scopeId }).catch(() => {
        // Quota / private-mode failures: keep the in-memory Canvas artifact.
    });
}
