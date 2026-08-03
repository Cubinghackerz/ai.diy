/**
 * Minimal WebDAV client (Basic auth) for chat backups — works with
 * Nextcloud, ownCloud, Box, and generic WebDAV servers. Runs fully in the
 * browser; credentials never leave the client.
 */

import type { CloudBackupFile, WebDAVStorageConfig } from "./types";

export class WebDAVError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "WebDAVError";
        this.status = status;
    }
}

function baseUrl(cfg: WebDAVStorageConfig): string {
    return cfg.url.replace(/\/+$/, "");
}

function keyUrl(cfg: WebDAVStorageConfig, key: string): string {
    const encoded = key
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    return `${baseUrl(cfg)}/${encoded}`;
}

function authHeader(cfg: WebDAVStorageConfig): string {
    return `Basic ${btoa(`${cfg.username}:${cfg.password}`)}`;
}

export async function webdavTestConnection(
    cfg: WebDAVStorageConfig,
): Promise<void> {
    const res = await fetch(baseUrl(cfg), {
        method: "PROPFIND",
        headers: {
            Authorization: authHeader(cfg),
            Depth: "0",
            "Content-Type": "application/xml",
        },
        body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>`,
    });
    if (res.status === 401 || res.status === 403) {
        throw new WebDAVError("Authentication failed. Check the username and password.", res.status);
    }
    if (!res.ok) {
        throw new WebDAVError(`WebDAV server returned HTTP ${res.status}.`, res.status);
    }
}

export async function webdavList(
    cfg: WebDAVStorageConfig,
    prefix: string,
): Promise<CloudBackupFile[]> {
    const res = await fetch(baseUrl(cfg), {
        method: "PROPFIND",
        headers: {
            Authorization: authHeader(cfg),
            Depth: "1",
            "Content-Type": "application/xml",
        },
        body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>`,
    });
    if (!res.ok) {
        throw new WebDAVError(`Could not list the folder (HTTP ${res.status}).`, res.status);
    }
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const ns = "DAV:";
    const basePath = new URL(baseUrl(cfg)).pathname;
    const out: CloudBackupFile[] = [];
    for (const response of Array.from(
        doc.getElementsByTagNameNS(ns, "response"),
    )) {
        const href = response.getElementsByTagNameNS(ns, "href")[0]
            ?.textContent;
        if (!href) continue;
        // hrefs are usually absolute URLs, but may also be relative paths.
        let path = href;
        try {
            path = decodeURIComponent(new URL(href, baseUrl(cfg)).pathname);
        } catch {
            continue;
        }
        const rel = path.startsWith(basePath)
            ? path.slice(basePath.length).replace(/^\/+/, "")
            : path.replace(/^\/+/, "");
        if (!rel.includes(prefix)) continue;
        const isCollection = Boolean(
            response.getElementsByTagNameNS(ns, "collection")[0],
        );
        if (isCollection) continue;
        const name = rel.split("/").filter(Boolean).pop() ?? "";
        if (!name.endsWith(".json")) continue;
        out.push({
            key: rel,
            size:
                Number(
                    response.getElementsByTagNameNS(ns, "getcontentlength")[0]
                        ?.textContent,
                ) || 0,
            modifiedAt:
                response.getElementsByTagNameNS(ns, "getlastmodified")[0]
                    ?.textContent ?? "",
        });
    }
    return out.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

export async function webdavUpload(
    cfg: WebDAVStorageConfig,
    key: string,
    body: string,
): Promise<void> {
    const prefix = key.split("/").slice(0, -1).join("/");
    if (prefix) {
        // Ensure the folder exists (Nextcloud creates it automatically, but
        // ownCloud and others return 409 otherwise).
        const mkcol = await fetch(keyUrl(cfg, prefix), {
            method: "MKCOL",
            headers: { Authorization: authHeader(cfg) },
        });
        // 405 (already a collection) and 301/302 (redirect) are fine.
        if (mkcol.status === 401 || mkcol.status === 403) {
            throw new WebDAVError(
                "Authentication failed. Check the username and password.",
                mkcol.status,
            );
        }
    }
    const res = await fetch(keyUrl(cfg, key), {
        method: "PUT",
        headers: {
            Authorization: authHeader(cfg),
            "Content-Type": "application/json",
        },
        body,
    });
    if (res.status === 401 || res.status === 403) {
        throw new WebDAVError("Authentication failed. Check the username and password.", res.status);
    }
    if (!res.ok && res.status !== 201 && res.status !== 204) {
        throw new WebDAVError(`Upload failed (HTTP ${res.status}).`, res.status);
    }
}

export async function webdavDownload(
    cfg: WebDAVStorageConfig,
    key: string,
): Promise<string> {
    const res = await fetch(keyUrl(cfg, key), {
        method: "GET",
        headers: { Authorization: authHeader(cfg) },
    });
    if (res.status === 401 || res.status === 403) {
        throw new WebDAVError("Authentication failed. Check the username and password.", res.status);
    }
    if (!res.ok) {
        throw new WebDAVError(`Download failed (HTTP ${res.status}).`, res.status);
    }
    return res.text();
}
