/**
 * Cloud storage configuration for chat backups.
 *
 * All credentials are stored only in browser localStorage alongside the
 * provider API keys — nothing is sent to any server except the storage
 * endpoint the user configures.
 */

export type CloudStorageKind = "none" | "s3" | "webdav";

export interface S3StorageConfig {
    /** e.g. https://s3.us-east-1.amazonaws.com, https://<acct>.r2.cloudflarestorage.com */
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    /** Optional key prefix inside the bucket, e.g. "ai-diy". */
    prefix?: string;
}

export interface WebDAVStorageConfig {
    /** e.g. https://cloud.example.com/remote.php/dav/files/me */
    url: string;
    username: string;
    password: string;
    prefix?: string;
}

export interface CloudStorageConfig {
    kind: CloudStorageKind;
    s3?: S3StorageConfig;
    webdav?: WebDAVStorageConfig;
    /** Upload a backup automatically after chat changes (debounced). */
    autoBackup: boolean;
    /** RFC 3339 timestamp of the last successful upload. */
    lastBackupAt?: string | null;
}

export const DEFAULT_CLOUD_STORAGE: CloudStorageConfig = {
    kind: "none",
    autoBackup: false,
    lastBackupAt: null,
};

export interface CloudBackupFile {
    key: string;
    size: number;
    modifiedAt: string;
}

export function cloudConfigComplete(cfg: CloudStorageConfig): boolean {
    if (cfg.kind === "s3") {
        const s3 = cfg.s3;
        return Boolean(
            s3?.endpoint &&
                s3.bucket &&
                s3.accessKeyId &&
                s3.secretAccessKey,
        );
    }
    if (cfg.kind === "webdav") {
        const d = cfg.webdav;
        return Boolean(d?.url && d.username && d.password);
    }
    return false;
}

export function backupPrefix(cfg: CloudStorageConfig): string {
    const raw =
        cfg.kind === "s3"
            ? cfg.s3?.prefix
            : cfg.kind === "webdav"
              ? cfg.webdav?.prefix
              : undefined;
    const trimmed = raw?.trim();
    return trimmed ? trimmed.replace(/^\/+|\/+$/g, "") : "ai-diy-backups";
}

export function backupKeyForNow(cfg: CloudStorageConfig): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${backupPrefix(cfg)}/backup-${stamp}.json`;
}
