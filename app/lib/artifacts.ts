/**
 * Shared constants safe for both client and server.
 */

/** Marker embedded in create_file tool results so the client can open Canvas. */
export const ARTIFACT_MARKER = "__prismium_artifact";

export type ArtifactContentEncoding = "base64" | "hex";

/** Decode binary artifact payloads without relying on Node-only Buffer APIs. */
export function decodeArtifactContent(
    content: string,
    encoding?: ArtifactContentEncoding,
): ArrayBuffer | null {
    if (!encoding) return null;

    if (encoding === "hex") {
        const normalized = content.replace(/\s+/g, "");
        if (!/^(?:[0-9a-f]{2})*$/i.test(normalized)) return null;
        const buffer = new ArrayBuffer(normalized.length / 2);
        const bytes = new Uint8Array(buffer);
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
        }
        return buffer;
    }

    try {
        const normalized = content.replace(/\s+/g, "");
        if (typeof atob !== "function") return null;
        const binary = atob(normalized);
        const buffer = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(buffer);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return buffer;
    } catch {
        return null;
    }
}
