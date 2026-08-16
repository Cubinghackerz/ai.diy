/**
 * Client-side settings encryption — AES-GCM at rest.
 *
 * The settings JSON (which holds provider API keys and cloud credentials) is
 * encrypted with a random 256-bit AES-GCM key. The key lives in IndexedDB
 * (separate from the localStorage payload), so a simple localStorage dump no
 * longer leaks credentials.
 *
 * Payload format in localStorage: `v1.<base64(iv)>.<base64(ciphertext)>`.
 *
 * Failure handling is deliberately conservative — never lock the user out
 * and never destroy data:
 * - No Web Crypto / IndexedDB (rare): falls back to plaintext, exactly the
 *   previous behavior.
 * - Ciphertext that cannot be decrypted: a backup copy is tried; if both
 *   fail, the provider enters recovery mode and the stored ciphertext is
 *   never overwritten.
 */

import {
    deleteSettingsCryptoKey,
    getSettingsCryptoKey,
    saveSettingsCryptoKey,
} from "~/lib/db";

export const SETTINGS_STORAGE_KEY = "prismium-lite:settings";
export const SETTINGS_ENC_KEY = "prismium-lite:settings.enc";
export const SETTINGS_ENC_BACKUP_KEY = "prismium-lite:settings.enc.bak";
/** Plaintext theme mirror so the pre-hydration script can apply dark mode. */
export const SETTINGS_THEME_KEY = "prismium-lite:theme";

const PAYLOAD_VERSION = "v1";
const IV_LENGTH = 12;

export function settingsCryptoAvailable(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof crypto !== "undefined" &&
        typeof crypto.subtle !== "undefined" &&
        typeof indexedDB !== "undefined"
    );
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> | null {
    try {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    } catch {
        return null;
    }
}

async function getOrCreateKey(): Promise<CryptoKey | null> {
    if (!settingsCryptoAvailable()) return null;
    const existing = await getSettingsCryptoKey();
    if (existing) return existing;
    try {
        // extractable so structured clone can persist it to IndexedDB.
        const key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"],
        );
        const saved = await saveSettingsCryptoKey(key);
        return saved ? key : null;
    } catch {
        return null;
    }
}

/** Encrypt a settings object into the "v1." payload string, or null on failure. */
export async function encryptSettingsPayload(
    value: unknown,
): Promise<string | null> {
    if (!settingsCryptoAvailable()) return null;
    const key = await getOrCreateKey();
    if (!key) return null;
    try {
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const data = new TextEncoder().encode(JSON.stringify(value));
        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            data,
        );
        return `${PAYLOAD_VERSION}.${bytesToBase64(iv)}.${bytesToBase64(
            new Uint8Array(ciphertext),
        )}`;
    } catch {
        return null;
    }
}

/** Decrypt a payload string back to the original object, or null on any failure. */
export async function decryptSettingsPayload(
    payload: string,
): Promise<unknown | null> {
    if (!settingsCryptoAvailable()) return null;
    const separator = payload.indexOf(".");
    if (separator <= 0) return null;
    const version = payload.slice(0, separator);
    if (version !== PAYLOAD_VERSION) return null;
    const dot = payload.indexOf(".", separator + 1);
    if (dot <= separator) return null;
    const iv = base64ToBytes(payload.slice(separator + 1, dot));
    const ciphertext = base64ToBytes(payload.slice(dot + 1));
    if (!iv || iv.length !== IV_LENGTH || !ciphertext) return null;
    const key = await getSettingsCryptoKey();
    if (!key) return null;
    try {
        const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext,
        );
        return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    } catch {
        return null;
    }
}

/** Remove the persisted envelope key (used by settings reset). */
export async function clearSettingsEnvelopeKey(): Promise<void> {
    await deleteSettingsCryptoKey();
}
