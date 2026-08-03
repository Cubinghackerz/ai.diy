/**
 * Cloud storage dispatch — test, list, upload, and download chat backups
 * through whichever storage backend the user configured (S3-compatible or
 * WebDAV). All requests happen directly from the browser.
 */

import type { CloudBackupFile, CloudStorageConfig } from "./types";
import { cloudConfigComplete, backupPrefix } from "./types";
import {
    s3TestConnection,
    s3ListObjects,
    s3Upload,
    s3Download,
} from "./s3";
import {
    webdavTestConnection,
    webdavList,
    webdavUpload,
    webdavDownload,
} from "./webdav";

export function cloudStorageError(error: unknown): string {
    return error instanceof Error ? error.message : "Cloud storage failed.";
}

export async function testCloudConnection(
    cfg: CloudStorageConfig,
): Promise<void> {
    if (!cloudConfigComplete(cfg)) {
        throw new Error("Complete the storage fields first.");
    }
    if (cfg.kind === "s3" && cfg.s3) {
        await s3TestConnection(cfg.s3);
        return;
    }
    if (cfg.kind === "webdav" && cfg.webdav) {
        await webdavTestConnection(cfg.webdav);
        return;
    }
    throw new Error("No storage backend selected.");
}

export async function listCloudBackups(
    cfg: CloudStorageConfig,
): Promise<CloudBackupFile[]> {
    if (cfg.kind === "s3" && cfg.s3) {
        return s3ListObjects(cfg.s3, backupPrefix(cfg));
    }
    if (cfg.kind === "webdav" && cfg.webdav) {
        return webdavList(cfg.webdav, backupPrefix(cfg));
    }
    return [];
}

export async function uploadBackup(
    cfg: CloudStorageConfig,
    key: string,
    body: string,
): Promise<void> {
    if (cfg.kind === "s3" && cfg.s3) {
        await s3Upload(cfg.s3, key, body);
        return;
    }
    if (cfg.kind === "webdav" && cfg.webdav) {
        await webdavUpload(cfg.webdav, key, body);
        return;
    }
    throw new Error("No storage backend selected.");
}

export async function downloadBackup(
    cfg: CloudStorageConfig,
    key: string,
): Promise<string> {
    if (cfg.kind === "s3" && cfg.s3) {
        return s3Download(cfg.s3, key);
    }
    if (cfg.kind === "webdav" && cfg.webdav) {
        return webdavDownload(cfg.webdav, key);
    }
    throw new Error("No storage backend selected.");
}
