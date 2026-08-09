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
 * Neutralize relative/root-relative navigation attrs so they cannot resolve
 * against the parent app origin inside a srcdoc iframe.
 */
function rewritePreviewNavigationAttributes(html: string): string {
    const attrs = ["href", "action", "formaction", "data-href"] as const;
    let next = html;
    for (const attr of attrs) {
        next = next.replace(
            new RegExp(`\\b${attr}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "gi"),
            (match, quote: string, raw: string) => {
                const value = String(raw).trim();
                if (!value || value.charAt(0) === "#") return match;
                if (/^(https?:|mailto:|tel:)/i.test(value)) return match;
                if (/^\/\//.test(value)) {
                    return `${attr}=${quote}https:${value}${quote}`;
                }
                // Relative, root-relative, javascript:, data:, etc.
                return `${attr}=${quote}#${quote}`;
            },
        );
    }
    return next;
}

/**
 * Wrap generated HTML before it goes into a sandboxed preview iframe.
 *
 * With `srcdoc`, relative and root-relative links resolve against the parent
 * app origin (e.g. `/pricing` becomes `https://your-host/pricing` and 404s).
 * We rewrite those attributes, pin `<base href="about:blank">`, and block
 * leftover navigations that are not absolute http(s)/mailto/tel. In-page
 * `#hash` anchors still work.
 */
export function preparePreviewDocument(html: string): string {
    const guardedHtml = rewritePreviewNavigationAttributes(html);
    const guard = [
        "<script>",
        "(function(){",
        'function allowNav(href){',
        'if(!href)return null;',
        'var h=String(href).trim();',
        'if(!h||h.charAt(0)==="#")return null;',
        'if(/^javascript:/i.test(h)||/^data:/i.test(h))return null;',
        'if(/^https?:\\/\\//i.test(h))return h;',
        'if(/^mailto:/i.test(h)||/^tel:/i.test(h))return h;',
        // Protocol-relative URLs are treated as https, never as app-origin paths.
        'if(/^\\/\\//.test(h))return "https:"+h;',
        // Relative, root-relative, and app-path links stay inside the preview dead-end.
        'return null;',
        "}",
        'function openExternal(href){var u=allowNav(href);if(u){try{window.open(u,"_blank","noopener,noreferrer")}catch(e){}}}',
        'document.addEventListener("click",function(e){',
        'var el=e.target&&e.target.closest?e.target.closest("a[href],area[href],[data-href]"):null;',
        "if(!el)return;",
        'var h=el.getAttribute("href")||el.getAttribute("data-href")||"";',
        'if(h.charAt(0)==="#")return;', // keep in-document anchors
        "e.preventDefault();e.stopPropagation();",
        "openExternal(h);",
        "},true);",
        'document.addEventListener("auxclick",function(e){',
        "if(e.button!==1)return;",
        'var el=e.target&&e.target.closest?e.target.closest("a[href],area[href]"):null;',
        "if(!el)return;",
        'var h=el.getAttribute("href")||"";',
        'if(h.charAt(0)==="#")return;',
        "e.preventDefault();e.stopPropagation();",
        "openExternal(h);",
        "},true);",
        'document.addEventListener("submit",function(e){',
        "e.preventDefault();e.stopPropagation();",
        'var form=e.target;var action=(form&&form.getAttribute&&form.getAttribute("action"))||"";',
        "openExternal(action);",
        "},true);",
        // Soft-block scripted navigations that would otherwise hit the parent origin.
        "try{",
        'var blocked=function(){return null;};',
        '["assign","replace"].forEach(function(m){try{window.location[m]=blocked}catch(e){}});',
        "var _open=window.open;",
        'window.open=function(url){var u=allowNav(url==null?"":String(url));if(!u)return null;return _open.call(window,u,"_blank","noopener,noreferrer")};',
        "}catch(e){}",
        "})();",
        "</script>",
    ].join("\n");
    // about:blank base stops relative/root-relative resolution against the host app.
    // Also hide matplotlib/jQuery-UI toolbar icon buttons whose sprites 404 under
    // about:blank (empty white squares next to PDF/PNG/SVG).
    const previewChrome = [
        "<style data-prismium-preview-chrome>",
        "/* Matplotlib webagg / jQuery UI icons fail without their theme assets */",
        ".ui-button-icon-only,.ui-icon,.matplotlib-toolbar .ui-button-icon-only,",
        "button.mpl-widget,a.mpl-widget{display:none!important}",
        ".ui-dialog-titlebar-close{display:none!important}",
        "img[src=''],img:not([src]){display:none!important}",
        "</style>",
    ].join("");
    const injection = `<base href="about:blank">\n${previewChrome}\n${guard}`;

    const headMatch = guardedHtml.match(/<head[^>]*>/i);
    if (headMatch) {
        return guardedHtml.replace(headMatch[0], `${headMatch[0]}\n${injection}`);
    }
    const htmlMatch = guardedHtml.match(/<html[^>]*>/i);
    if (htmlMatch) {
        return guardedHtml.replace(htmlMatch[0], `${htmlMatch[0]}\n<head>${injection}</head>`);
    }
    return `<!doctype html>\n<html>\n<head>${injection}</head>\n<body>\n${guardedHtml}\n</body>\n</html>`;
}

export function isImageMimeType(mimeType?: string | null): boolean {
    return Boolean(mimeType && /^image\//i.test(mimeType));
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
