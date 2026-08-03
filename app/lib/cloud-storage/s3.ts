/**
 * Minimal S3-compatible client (AWS SigV4) that runs entirely in the
 * browser — works with AWS S3, Cloudflare R2, MinIO, Backblaze B2, and
 * Wasabi. Signing uses the Web Crypto API; the secret key never leaves the
 * browser.
 */

import type { CloudBackupFile, S3StorageConfig } from "./types";

export class S3Error extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "S3Error";
        this.status = status;
    }
}

function sha256Hex(data: ArrayBuffer | string): Promise<string> {
    const bytes =
        typeof data === "string" ? new TextEncoder().encode(data) : data;
    return crypto.subtle.digest("SHA-256", bytes).then((digest) =>
        Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""),
    );
}

async function hmac(
    key: ArrayBuffer | Uint8Array | string,
    data: string,
): Promise<ArrayBuffer> {
    const keyBytes =
        typeof key === "string" ? new TextEncoder().encode(key) : key;
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes as BufferSource,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    return crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        new TextEncoder().encode(data),
    );
}

function isoDateParts(date: Date): { amz: string; day: string } {
    const amz = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    return { amz, day: amz.slice(0, 8) };
}

function hmacSigningKey(
    secretKey: string,
    date: Date,
    region: string,
    service: string,
): Promise<ArrayBuffer> {
    const { day } = isoDateParts(date);
    return (async () => {
        const kDate = await hmac(`AWS4${secretKey}`, day);
        const kRegion = await hmac(kDate, region);
        const kService = await hmac(kRegion, service);
        return hmac(kService, "aws4_request");
    })();
}

export function s3ObjectUrl(
    cfg: S3StorageConfig,
    key: string,
): string {
    const base = cfg.endpoint.replace(/\/+$/, "");
    const bucket = encodeURIComponent(cfg.bucket);
    const encodedKey = key
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
    return `${base}/${bucket}/${encodedKey}`;
}

export interface S3SignInput {
    method: string;
    /** Full request URL (canonical path + query derived from it). */
    url: URL;
    /** Exact headers to sign, lowercase keys. */
    headers: Record<string, string>;
    payloadHash: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    date: Date;
}

/**
 * AWS SigV4 request signing. Exported separately so the algorithm can be
 * verified against the AWS documentation test vectors (scripts/s3-sign-smoke.mjs).
 */
export async function buildS3Auth(
    input: S3SignInput,
): Promise<{ authorization: string; xAmzDate: string }> {
    const { amz } = isoDateParts(input.date);
    const url = input.url;

    // AWS requires signed headers in lexicographic (lowercase) order.
    const signedHeaderNames = Object.keys(input.headers).sort();
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalHeaders = signedHeaderNames
        .map((name) => `${name}:${input.headers[name].trim()}\n`)
        .join("");

    const canonicalQuery = [...url.searchParams.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([name, value]) => `${name}=${value}`)
        .join("&");

    const canonicalRequest = [
        input.method,
        url.pathname,
        canonicalQuery,
        canonicalHeaders,
        signedHeaders,
        input.payloadHash,
    ].join("\n");

    const scope = `${amz.slice(0, 8)}/${input.region}/s3/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amz,
        scope,
        await sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = await hmacSigningKey(
        input.secretAccessKey,
        input.date,
        input.region,
        "s3",
    );
    const signature = Array.from(
        new Uint8Array(await hmac(signingKey, stringToSign)),
    )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return { authorization, xAmzDate: amz };
}

async function s3Request(
    cfg: S3StorageConfig,
    method: string,
    key: string,
    query: Record<string, string>,
    body?: ArrayBuffer | string,
    contentType?: string,
): Promise<Response> {
    const url = new URL(s3ObjectUrl(cfg, key));
    for (const [name, value] of Object.entries(query)) {
        url.searchParams.set(name, value);
    }

    const now = new Date();
    const payloadHash = await sha256Hex(
        typeof body === "string" ? body : body ?? "",
    );
    const host = url.host;

    const headers: Record<string, string> = {
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": isoDateParts(now).amz,
    };
    if (contentType) headers["content-type"] = contentType;

    const { authorization, xAmzDate } = await buildS3Auth({
        method,
        url,
        headers,
        payloadHash,
        region: cfg.region,
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
        date: now,
    });

    const res = await fetch(url, {
        method,
        headers: {
            "x-amz-content-sha256": payloadHash,
            "x-amz-date": xAmzDate,
            authorization,
            ...(contentType ? { "content-type": contentType } : {}),
        },
        body:
            typeof body === "string" || body === undefined
                ? body
                : new Uint8Array(body),
    });
    return res;
}

async function s3Error(res: Response, fallback: string): Promise<never> {
    let detail = "";
    try {
        const text = await res.text();
        const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
        const message = /<Message>([^<]+)<\/Message>/.exec(text)?.[1];
        detail = code ? `${code}${message ? ` — ${message}` : ""}` : text.slice(0, 200);
    } catch {
        /* ignore */
    }
    throw new S3Error(
        detail ? `${fallback}: ${detail}` : fallback,
        res.status,
    );
}

export async function s3TestConnection(cfg: S3StorageConfig): Promise<void> {
    const res = await s3Request(cfg, "GET", "", { "max-keys": "1", "list-type": "2" });
    if (!res.ok) {
        await s3Error(
            res,
            `Could not reach bucket "${cfg.bucket}" at ${cfg.endpoint}`,
        );
    }
}

export async function s3ListObjects(
    cfg: S3StorageConfig,
    prefix: string,
): Promise<CloudBackupFile[]> {
    const res = await s3Request(cfg, "GET", "", {
        "list-type": "2",
        prefix,
        "max-keys": "100",
    });
    if (!res.ok) await s3Error(res, "Could not list objects");
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const out: CloudBackupFile[] = [];
    for (const contents of Array.from(doc.getElementsByTagName("Contents"))) {
        const get = (tag: string) =>
            contents.getElementsByTagName(tag)[0]?.textContent ?? "";
        const key = get("Key");
        if (!key) continue;
        out.push({
            key,
            size: Number(get("Size")) || 0,
            modifiedAt: get("LastModified"),
        });
    }
    return out.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

export async function s3Upload(
    cfg: S3StorageConfig,
    key: string,
    body: string,
): Promise<void> {
    const res = await s3Request(
        cfg,
        "PUT",
        key,
        {},
        body,
        "application/json",
    );
    if (!res.ok && res.status !== 200 && res.status !== 201) {
        await s3Error(res, "Could not upload backup");
    }
}

export async function s3Download(
    cfg: S3StorageConfig,
    key: string,
): Promise<string> {
    const res = await s3Request(cfg, "GET", key, {});
    if (!res.ok) await s3Error(res, "Could not download backup");
    return res.text();
}
