/**
 * Google Drive backup backend (OAuth2 service-account JWT, fully client-side).
 *
 * The user pastes a Google Cloud service-account key JSON. We build and RS256-
 * sign a short-lived JWT using the Web Crypto API (the private key never leaves
 * this device and is only sent to Google's token endpoint), exchange it for an
 * access token, then call the Drive REST API directly from the browser. The
 * full Drive scope is required so the service account can find and update a
 * shared backup folder; share that folder with the service account's
 * `client_email` when it should be visible from a normal Google account.
 */

import type { CloudBackupFile, GoogleDriveStorageConfig } from "./types";

export class GDriveError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "GDriveError";
        this.status = status;
    }
}

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const SCOPES = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Module-level token cache keyed by service account, so repeated Drive calls
 *  within an hour skip the token exchange. */
const tokenCache = new Map<
    string,
    { accessToken: string; expiresAt: number }
>();

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeText(text: string): string {
    return base64UrlEncode(new TextEncoder().encode(text));
}

/** Accepts a Google service-account PKCS#8 private key. */
function pemToPkcs8Der(pem: string): ArrayBuffer {
    if (!/-----BEGIN PRIVATE KEY-----/.test(pem)) {
        throw new GDriveError(
            "The Google key must contain a PKCS#8 BEGIN PRIVATE KEY block.",
        );
    }
    const base64 = pem
        .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "")
        .replace(/-----END [A-Z ]*PRIVATE KEY-----/g, "")
        .replace(/\s+/g, "");
    const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return der.buffer;
}

interface ParsedKey {
    clientEmail: string;
    privateKey: string;
    tokenUri: string;
    keyId?: string;
}

function parseKey(keyJson: string): ParsedKey {
    let key: Record<string, unknown>;
    try {
        key = JSON.parse(keyJson) as Record<string, unknown>;
    } catch {
        throw new GDriveError("The Google service-account key is not valid JSON.");
    }
    const clientEmail = String(key.client_email ?? "");
    const privateKey = String(key.private_key ?? "");
    if (!clientEmail || !privateKey) {
        throw new GDriveError(
            "The service-account key is missing client_email or private_key.",
        );
    }
    return {
        clientEmail,
        privateKey,
        tokenUri:
            String(key.token_uri ?? "https://oauth2.googleapis.com/token"),
        keyId: key.private_key_id ? String(key.private_key_id) : undefined,
    };
}

async function getAccessToken(cfg: GoogleDriveStorageConfig): Promise<string> {
    const key = parseKey(cfg.keyJson);
    const cacheKey = `${key.clientEmail}@${key.tokenUri}:${key.keyId ?? key.privateKey.slice(-32)}`;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const cached = tokenCache.get(cacheKey);
    if (cached && nowSeconds < cached.expiresAt - 60) {
        return cached.accessToken;
    }

    const signingKey = await crypto.subtle.importKey(
        "pkcs8",
        pemToPkcs8Der(key.privateKey),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"],
    );

    const header: Record<string, string> = { alg: "RS256", typ: "JWT" };
    if (key.keyId) header.kid = key.keyId;
    const claims = {
        iss: key.clientEmail,
        scope: SCOPES,
        aud: key.tokenUri,
        iat: nowSeconds,
        exp: nowSeconds + 3600,
    };
    const signingInput =
        `${base64UrlEncodeText(JSON.stringify(header))}.` +
        base64UrlEncodeText(JSON.stringify(claims));
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        signingKey,
        new TextEncoder().encode(signingInput),
    );
    const assertion = `${signingInput}.${base64UrlEncode(
        new Uint8Array(signature),
    )}`;

    const res = await fetch(key.tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion,
        }),
    });
    const text = await res.text();
    let data: { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    try {
        data = JSON.parse(text) as typeof data;
    } catch {
        throw new GDriveError(
            `Google token exchange failed (HTTP ${res.status}): ${text.slice(0, 200) || "empty response"}`,
            res.status,
        );
    }
    if (!res.ok || !data.access_token) {
        throw new GDriveError(
            `Google token exchange failed (HTTP ${res.status}): ${data.error ?? "unknown"}${
                data.error_description ? ` — ${data.error_description}` : ""
            }`,
            res.status,
        );
    }
    tokenCache.set(cacheKey, {
        accessToken: data.access_token,
        expiresAt: nowSeconds + (data.expires_in ?? 3600),
    });
    return data.access_token;
}

async function driveFetch(
    cfg: GoogleDriveStorageConfig,
    path: string,
    init: RequestInit & { query?: Record<string, string> } = {},
): Promise<Response> {
    const token = await getAccessToken(cfg);
    const url = new URL(path, DRIVE_BASE);
    if (init.query) {
        for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
    }
    return fetch(url, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...init.headers,
        },
    });
}

async function driveError(res: Response, fallback: string): Promise<never> {
    const text = await res.text().catch(() => "");
    let detail = text.slice(0, 300);
    try {
        const json = JSON.parse(text) as { error?: { code?: number; message?: string } };
        if (json.error?.message) detail = json.error.message;
    } catch {
        /* non-JSON error body */
    }
    throw new GDriveError(
        detail ? `${fallback}: ${detail}` : fallback,
        res.status,
    );
}

/** Find the backup folder by name, creating it if missing. Returns its id. */
export async function resolveGDriveFolder(
    cfg: GoogleDriveStorageConfig,
    folderName: string,
): Promise<string> {
    if (cfg.folderId) return cfg.folderId;
    const escaped = folderName.replace(/'/g, "\\'");
    const search = await driveFetch(
        cfg,
        "/files",
        {
            query: {
                q:
                    `mimeType='${FOLDER_MIME}' and trashed=false and name='${escaped}'`,
                fields: "files(id,name)",
                pageSize: "10",
            },
        },
    );
    if (!search.ok) await driveError(search, "Could not look up the backup folder");
    const found = (await search.json()) as {
        files?: Array<{ id: string; name: string }>;
    };
    for (const file of found.files ?? []) {
        if (file.name === folderName) return file.id;
    }
    const create = await driveFetch(cfg, "/files", {
        method: "POST",
        body: JSON.stringify({
            name: folderName,
            mimeType: FOLDER_MIME,
        }),
    });
    if (!create.ok) await driveError(create, "Could not create the backup folder");
    const created = (await create.json()) as { id?: string };
    if (!created.id) throw new GDriveError("Drive did not return a folder id.");
    return created.id;
}

export async function gdriveTestConnection(
    cfg: GoogleDriveStorageConfig,
): Promise<void> {
    const res = await driveFetch(cfg, "/about", { query: { fields: "user" } });
    if (!res.ok) await driveError(res, "Could not connect to Google Drive");
}

export async function gdriveListObjects(
    cfg: GoogleDriveStorageConfig,
    prefix: string,
): Promise<CloudBackupFile[]> {
    const folderId = await resolveGDriveFolder(cfg, prefix);
    const q =
        `'${folderId}' in parents and trashed=false and mimeType != '${FOLDER_MIME}'`;
    const res = await driveFetch(
        cfg,
        "/files",
        {
            query: {
                q,
                fields: "files(id,name,size,modifiedTime)",
                pageSize: "100",
            },
        },
    );
    if (!res.ok) await driveError(res, "Could not list the backup folder");
    const json = (await res.json()) as {
        files?: Array<{ id: string; name: string; size?: string; modifiedTime?: string }>;
    };
    return (json.files ?? [])
        .map((file) => ({
            key: `${prefix}/${file.name}`,
            fileId: file.id,
            size: Number(file.size) || 0,
            modifiedAt: file.modifiedTime ?? "",
        }))
        .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

/** key format is "<folder>/<filename>" (bucket-style) — Drive maps the folder
 *  to parents and the filename to `name`. */
export async function gdriveUpload(
    cfg: GoogleDriveStorageConfig,
    key: string,
    body: string,
): Promise<void> {
    const parts = key.split("/");
    const folderName = parts.length > 1
        ? parts.slice(0, -1).join("/")
        : "ai-diy-backups";
    const fileName = parts[parts.length - 1];
    const folderId = await resolveGDriveFolder(cfg, folderName);

    const boundary = `ai-diy-${Date.now().toString(36)}`;
    const meta = JSON.stringify({ name: fileName, parents: [folderId] });
    const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        "",
        meta,
        `--${boundary}`,
        "Content-Type: application/json",
        "",
        body,
        `--${boundary}--`,
        "",
    ].join("\r\n");

    const res = await fetch(`${UPLOAD_BASE}/files?uploadType=multipart`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${await getAccessToken(cfg)}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
    });
    if (!res.ok) await driveError(res, "Upload to Google Drive failed");
}

export async function gdriveDownload(
    cfg: GoogleDriveStorageConfig,
    item: CloudBackupFile,
): Promise<string> {
    if (!item.fileId) {
        throw new GDriveError("No Google Drive file id for this backup.");
    }
    const res = await driveFetch(cfg, `/files/${encodeURIComponent(item.fileId)}`, {
        query: { alt: "media" },
    });
    if (!res.ok) await driveError(res, "Download from Google Drive failed");
    return res.text();
}
