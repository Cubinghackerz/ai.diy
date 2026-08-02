/**
 * Shared constants safe for both client and server.
 */

/** Marker embedded in create_file tool results so the client can open Canvas. */
export const ARTIFACT_MARKER = "__prismium_artifact";

export type ArtifactContentEncoding = "base64" | "hex";

/** Short deterministic key that avoids retaining a second copy of large content. */
export function artifactContentHash(content: string): string {
    let hash = 2166136261;
    for (let index = 0; index < content.length; index += 1) {
        hash ^= content.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

/**
 * Wrap generated HTML before it goes into a sandboxed preview iframe.
 *
 * With `srcdoc`, relative and root-relative links resolve against the parent
 * app's URL, so clicking a button or link would load ai.diy inside the preview
 * panel. We inject a `<base target="_blank">` plus a capture-phase guard so
 * every link/form navigation leaves the iframe (opens a new tab) instead of
 * hijacking the preview. Anchor `#hash` navigation is kept in place.
 */
export function preparePreviewDocument(html: string): string {
    const guard = [
        "<script>",
        "(function(){",
        'function externalUrl(href){try{var u=new URL(href,window.location.href);if(u.protocol==="http:"||u.protocol==="https:")return u.toString()}catch(e){}return null}',
        'document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;var h=a.getAttribute("href");if(!h||h.charAt(0)==="#")return;e.preventDefault();var u=externalUrl(h);if(u)window.open(u,"_blank","noopener")},true);',
        'document.addEventListener("submit",function(e){e.preventDefault();var u=externalUrl(e.target&&e.target.action||"");if(u)window.open(u,"_blank","noopener")},true);',
        "})();",
        "</script>",
    ].join("\n");
    const injection = `<base target="_blank">\n${guard}`;

    const headMatch = html.match(/<head[^>]*>/i);
    if (headMatch) {
        return html.replace(headMatch[0], `${headMatch[0]}\n${injection}`);
    }
    const htmlMatch = html.match(/<html[^>]*>/i);
    if (htmlMatch) {
        return html.replace(htmlMatch[0], `${htmlMatch[0]}\n<head>${injection}</head>`);
    }
    return `<!doctype html>\n<html>\n<head>${injection}</head>\n<body>\n${html}\n</body>\n</html>`;
}

export function inferArtifactMimeType(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase();
    switch (extension) {
        case "docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        case "xlsx":
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        case "pptx":
            return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        case "pdf":
            return "application/pdf";
        case "csv":
            return "text/csv;charset=utf-8";
        case "json":
            return "application/json";
        case "svg":
            return "image/svg+xml";
        case "html":
            return "text/html;charset=utf-8";
        case "txt":
        case "md":
            return "text/plain;charset=utf-8";
        case "png":
            return "image/png";
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "gif":
            return "image/gif";
        case "webp":
            return "image/webp";
        case "zip":
            return "application/zip";
        default:
            return "application/octet-stream";
    }
}

function reportArtifactDecodeFailure(
    encoding: ArtifactContentEncoding,
    reason: string,
    content: string,
) {
    if (typeof console === "undefined") return;
    const compact = content.trim();
    console.warn("[artifact] binary payload could not be decoded", {
        encoding,
        reason,
        length: compact.length,
        modulo4: encoding === "base64" ? compact.replace(/\s+/g, "").length % 4 : undefined,
        hasDataUrlPrefix: /^data:[^,]+,\s*/i.test(compact),
        hasMarkdownFence: /^```/.test(compact) || /```$/.test(compact),
        hasPythonBytesPrefix: /^b[\'\"]/.test(compact),
        hasUrlSafeCharacters: /[-_]/.test(compact),
    });
}

function normalizeEncodedContent(content: string, encoding: ArtifactContentEncoding): string {
    let normalized = content.trim();

    // Accept common formats models return when moving bytes between tools.
    normalized = normalized
        .replace(/^```(?:base64|hex)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    if (/^data:[^,]+,/i.test(normalized)) {
        normalized = normalized.slice(normalized.indexOf(",") + 1).trim();
    }
    normalized = normalized.replace(/^(?:base64|hex)\s*[:=]\s*/i, "");

    const pythonBytes = normalized.match(/^b([\'\"])([\s\S]*)\1$/);
    if (pythonBytes) normalized = pythonBytes[2];

    const quoted = normalized.match(/^[\'\"]([\s\S]*)\1$/);
    if (quoted) normalized = quoted[1];

    normalized = normalized.replace(/\s+/g, "");
    if (encoding === "hex") {
        return normalized.replace(/^0x/i, "");
    }

    // Python's urlsafe_b64encode uses URL-safe characters; browsers' atob
    // expects the standard alphabet. Add omitted padding when unambiguous.
    normalized = normalized.replace(/-/g, "+").replace(/_/g, "/");
    const remainder = normalized.length % 4;
    if (remainder === 2) normalized += "==";
    else if (remainder === 3) normalized += "=";
    return normalized;
}

/** Decode binary artifact payloads without relying on Node-only Buffer APIs. */
export function decodeArtifactContent(
    content: string,
    encoding?: ArtifactContentEncoding,
): ArrayBuffer | null {
    if (!encoding) return null;

    const normalized = normalizeEncodedContent(content, encoding);
    if (encoding === "hex") {
        if (!/^(?:[0-9a-f]{2})*$/i.test(normalized)) {
            reportArtifactDecodeFailure(encoding, "invalid-hex", content);
            return null;
        }
        const buffer = new ArrayBuffer(normalized.length / 2);
        const bytes = new Uint8Array(buffer);
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
        }
        return buffer;
    }

    try {
        if (typeof atob !== "function") {
            reportArtifactDecodeFailure(encoding, "atob-unavailable", content);
            return null;
        }
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
            reportArtifactDecodeFailure(encoding, "invalid-base64-characters-or-padding", content);
            return null;
        }
        const binary = atob(normalized);
        const buffer = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(buffer);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return buffer;
    } catch {
        reportArtifactDecodeFailure(encoding, "invalid-base64", content);
        return null;
    }
}
