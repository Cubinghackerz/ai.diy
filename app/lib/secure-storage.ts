/**
 * Secure browser storage — AES-GCM encryption of localStorage values with a
 * user-supplied passphrase. Uses the Web Crypto API and PBKDF2 (SHA-256).
 *
 * Storage layout (all keys under `prismium-lite:`):
 *   - `settings` — full app settings (encrypted blob when encryption is on)
 *   - `settings-meta` — tiny unencrypted envelope holding only `{ theme }`
 *     so the root layout inline script can apply the correct theme before
 *     React hydrates.
 *   - `settings-key-check` — a known ciphertext the passphrase is tested against
 *     (written when encryption is first enabled; removed when disabled).
 *
 * Passphrase management:
 *   - The passphrase is NEVER persisted. It lives only in memory for the
 *     lifetime of the tab session.
 *   - When encryption is enabled, the user must enter the passphrase on every
 *     fresh load. SettingsProvider exposes `decryptPassphrase` and
 *     `enableEncryption` / `disableEncryption` controls.
 */

import type { AppSettings, DEFAULT_SETTINGS } from "~/lib/types";

const STORAGE_KEY = "prismium-lite:settings";
const META_KEY = "prismium-lite:settings-meta";
const KEY_CHECK_KEY = "prismium-lite:settings-key-check";
const ITERATIONS = 200_000;

const KNOWN_PLAINTEXT = "ai.diy-settings-ok";

interface EncryptedBlob {
    v: 1;
    salt: string;
    nonce: string;
    ciphertext: string;
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
    const bytes = ArrayBuffer.isView(buf)
        ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        : new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function fromB64(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function strToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

function bytesToStr(bytes: Uint8Array | ArrayBuffer): string {
    const b = ArrayBuffer.isView(bytes)
        ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : new Uint8Array(bytes);
    return new TextDecoder().decode(b);
}

/** Derive an AES-GCM CryptoKey from a passphrase + salt via PBKDF2. */
async function deriveKey(
    passphrase: string,
    salt: Uint8Array,
): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        strToBytes(passphrase) as BufferSource,
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"],
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
}

/** Random bytes for salt/nonce. */
function randomBytes(len: number): Uint8Array {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return bytes;
}

/** Encrypt a plaintext string with a passphrase. Returns a JSON blob string. */
export async function encryptValue(
    value: string,
    passphrase: string,
): Promise<string> {
    const salt = randomBytes(16);
    const nonce = randomBytes(12);
    const key = await deriveKey(passphrase, salt);
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce as BufferSource },
        key,
        strToBytes(value) as BufferSource,
    );
    const blob: EncryptedBlob = {
        v: 1,
        salt: toB64(salt),
        nonce: toB64(nonce),
        ciphertext: toB64(ciphertext),
    };
    return JSON.stringify(blob);
}

/** Attempt to decrypt a blob produced by `encryptValue`. Returns null on failure. */
export async function decryptValue(
    encrypted: string,
    passphrase: string,
): Promise<string | null> {
    try {
        const blob = JSON.parse(encrypted) as EncryptedBlob;
        if (blob.v !== 1) return null;
        const salt = fromB64(blob.salt);
        const nonce = fromB64(blob.nonce);
        const ciphertext = fromB64(blob.ciphertext);
        const key = await deriveKey(passphrase, salt);
        const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: nonce as BufferSource },
            key,
            ciphertext as BufferSource,
        );
        return bytesToStr(plaintext);
    } catch {
        return null;
    }
}

/**
 * Write a passphrase verifier. Encrypts a known plaintext with a fresh salt;
 * on later loads we attempt to decrypt it to verify the passphrase matches.
 */
export async function storeKeyCheck(passphrase: string): Promise<void> {
    const salt = randomBytes(16);
    const nonce = randomBytes(12);
    const key = await deriveKey(passphrase, salt);
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce as BufferSource },
        key,
        strToBytes(KNOWN_PLAINTEXT) as BufferSource,
    );
    localStorage.setItem(
        KEY_CHECK_KEY,
        JSON.stringify({
            salt: toB64(salt),
            nonce: toB64(nonce),
            ciphertext: toB64(ciphertext),
        }),
    );
}

/** Check if a passphrase matches the stored key-check verifier. */
export async function verifyPassphrase(passphrase: string): Promise<boolean> {
    const raw = localStorage.getItem(KEY_CHECK_KEY);
    if (!raw) return false;
    try {
        const record = JSON.parse(raw) as {
            salt: string;
            nonce: string;
            ciphertext: string;
        };
        const salt = fromB64(record.salt);
        const nonce = fromB64(record.nonce);
        const ciphertext = fromB64(record.ciphertext);
        const key = await deriveKey(passphrase, salt);
        const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: nonce as BufferSource },
            key,
            ciphertext as BufferSource,
        );
        return bytesToStr(plaintext) === KNOWN_PLAINTEXT;
    } catch {
        return false;
    }
}

export function clearKeyCheck(): void {
    localStorage.removeItem(KEY_CHECK_KEY);
}

export function hasKeyCheck(): boolean {
    return localStorage.getItem(KEY_CHECK_KEY) !== null;
}

/**
 * Persist settings, optionally encrypted.
 * The theme is always stored unencrypted in the meta key so the server-side
 * layout script can apply it before React hydrates.
 */
export async function persistSettings(
    settings: AppSettings,
    encryptionEnabled: boolean,
    passphrase: string | null,
): Promise<void> {
    const serialised = JSON.stringify(settings);
    const { theme } = settings;

    localStorage.setItem(META_KEY, JSON.stringify({ theme }));

    if (encryptionEnabled && passphrase) {
        const encrypted = await encryptValue(serialised, passphrase);
        localStorage.setItem(STORAGE_KEY, encrypted);
    } else {
        localStorage.setItem(STORAGE_KEY, serialised);
    }
}

/**
 * Load the encryption preference and passphrase prompt state from localStorage.
 * This only reads the meta key (unencrypted) and checks whether a key-check
 * verifier exists. The actual passphrase is NOT stored.
 */
export function loadEncryptionPreference(): {
    encryptionEnabled: boolean;
    hasPassphraseVerifier: boolean;
    theme: "light" | "dark" | "system";
} {
    let theme: "light" | "dark" | "system" = "system";
    const metaRaw = localStorage.getItem(META_KEY);
    if (metaRaw) {
        try {
            const meta = JSON.parse(metaRaw) as { theme?: string };
            if (meta.theme === "light" || meta.theme === "dark") {
                theme = meta.theme;
            }
        } catch {
            // fall through
        }
    }

    const hasKeyCheckResult = hasKeyCheck();

    return {
        encryptionEnabled: hasKeyCheckResult,
        hasPassphraseVerifier: hasKeyCheckResult,
        theme,
    };
}

/**
 * Load settings from localStorage, attempting decryption if encryption is on.
 * Returns null if the data cannot be read or decrypted (e.g. wrong passphrase).
 */
export async function loadSettings(
    encryptionEnabled: boolean,
    passphrase: string | null,
): Promise<AppSettings | null> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    let json: string;
    if (encryptionEnabled && passphrase) {
        const decrypted = await decryptValue(raw, passphrase);
        if (decrypted === null) return null;
        json = decrypted;
    } else {
        json = raw;
    }

    try {
        return JSON.parse(json) as AppSettings;
    } catch {
        return null;
    }
}

/** Read just the theme — works whether or not settings are encrypted. */
export function readTheme(): "light" | "dark" | "system" {
    const metaRaw = localStorage.getItem(META_KEY);
    if (metaRaw) {
        try {
            const meta = JSON.parse(metaRaw) as { theme?: string };
            if (meta.theme === "light" || meta.theme === "dark") return meta.theme;
            if (meta.theme === "system") return "system";
        } catch {
            // fall through
        }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as { theme?: string };
            const theme = parsed.theme;
            if (theme === "light" || theme === "dark" || theme === "system") return theme;
        } catch {
            // might be encrypted — ignore
        }
    }
    return "system";
}

/**
 * Persist settings with a new passphrase, re-encrypting all data.
 * Call this when the user enables encryption or changes their passphrase.
 */
export async function enableEncryption(
    settings: AppSettings,
    newPassphrase: string,
): Promise<boolean> {
    await storeKeyCheck(newPassphrase);
    await persistSettings(settings, true, newPassphrase);
    return true;
}

/**
 * Disable encryption: re-save settings as plaintext and clear the key check.
 */
export async function disableEncryption(
    settings: AppSettings,
): Promise<void> {
    clearKeyCheck();
    await persistSettings(settings, false, null);
}

/**
 * Migrate existing plaintext settings to encrypted storage.
 * This is called once when a user enables encryption for the first time.
 */
export async function migratePlaintextToEncrypted(
    settings: AppSettings,
    passphrase: string,
): Promise<boolean> {
    return enableEncryption(settings, passphrase);
}
