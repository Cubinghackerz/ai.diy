/**
 * AES-256-GCM at-rest encryption for persisted ChatGPT sessions.
 *
 * Values written through an EncryptedKeyValueStore are encrypted with a key
 * deterministically derived from the ChatGPT secret, so a plain dump of the
 * backing store (`.data/chatgpt-sessions.json` or a Redis keyspace) reveals
 * only ciphertext. Each entry uses a fresh 12-byte IV; the auth tag is
 * embedded in the payload.
 *
 * Payload format: `enc:v1.<iv base64>.<tag base64>.<ciphertext base64>`.
 *
 * A decrypt failure (e.g. the secret changed or the entry was corrupted) is
 * treated as a missing entry — the affected login expires and the user signs
 * in again; stored ciphertext is never overwritten on a failed read. Legacy
 * plaintext entries written before encryption are removed on first read so
 * no credentials linger at rest.
 */

import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";
import type { KeyValueStore } from "@opencoredev/loginwithchatgpt-core";

const STORE_ENC_PREFIX = "enc:v1:";
const CHATGPT_STORE_ENC_KEY_CONTEXT = "ai.diy:chatgpt-session-store:v1:";

function deriveStoreEncryptionKey(secret: string, keyContext: string): Buffer {
    return createHash("sha256")
        .update(`${keyContext}${secret}`)
        .digest();
}

function encryptStoreValue(
    secret: string,
    value: unknown,
    keyContext: string,
): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
        "aes-256-gcm",
        deriveStoreEncryptionKey(secret, keyContext),
        iv,
    );
    const data = Buffer.from(JSON.stringify(value), "utf8");
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    return `${STORE_ENC_PREFIX}${iv.toString("base64")}.${cipher
        .getAuthTag()
        .toString("base64")}.${ciphertext.toString("base64")}`;
}

function decryptStoreValue(
    secret: string,
    payload: string,
    keyContext: string,
): unknown | null {
    if (!payload.startsWith(STORE_ENC_PREFIX)) return null;
    const parts = payload.slice(STORE_ENC_PREFIX.length).split(".");
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, ciphertextB64] = parts;
    if (!ivB64 || !tagB64 || !ciphertextB64) return null;
    try {
        const decipher = createDecipheriv(
            "aes-256-gcm",
            deriveStoreEncryptionKey(secret, keyContext),
            Buffer.from(ivB64, "base64"),
        );
        decipher.setAuthTag(Buffer.from(tagB64, "base64"));
        const plaintext = Buffer.concat([
            decipher.update(Buffer.from(ciphertextB64, "base64")),
            decipher.final(),
        ]);
        return JSON.parse(plaintext.toString("utf8")) as unknown;
    } catch {
        return null;
    }
}

/**
 * KeyValueStore decorator that encrypts values at rest with AES-256-GCM.
 * The backing store holds opaque strings; TTL and deletion semantics are
 * delegated to the wrapped store unchanged.
 */
export class EncryptedKeyValueStore<T> implements KeyValueStore<T> {
    private warned = false;
    private readonly inner: KeyValueStore<string>;
    private readonly secret: string;
    private readonly label: string;
    private readonly keyContext: string;

    constructor(
        inner: KeyValueStore<string>,
        secret: string,
        options: {
            label?: string;
            keyContext?: string;
        } = {},
    ) {
        this.inner = inner;
        this.secret = secret;
        this.label = options.label ?? "session";
        this.keyContext =
            options.keyContext ?? CHATGPT_STORE_ENC_KEY_CONTEXT;
    }

    async get(key: string): Promise<T | undefined> {
        const raw = await this.inner.get(key);
        if (raw === undefined) return undefined;
        // Legacy plaintext (string or pre-encryption object payload) from
        // before at-rest encryption: provably unreadable, so remove it so no
        // credentials linger at rest.
        if (typeof raw !== "string" || !raw.startsWith(STORE_ENC_PREFIX)) {
            if (!this.warned) {
                this.warned = true;
                console.warn(
                    `[${this.label}] Removed a legacy plaintext session written before at-rest encryption; a fresh sign-in is required.`,
                );
            }
            await this.inner.delete(key);
            return undefined;
        }
        const value = decryptStoreValue(this.secret, raw, this.keyContext);
        if (value === null) {
            if (!this.warned) {
                this.warned = true;
                console.warn(
                    `[${this.label}] A stored session could not be decrypted (session secret changed or data corrupted); the affected login will require a fresh sign-in.`,
                );
            }
            return undefined;
        }
        return value as T;
    }

    async set(
        key: string,
        value: T,
        options?: { ttlMs?: number },
    ): Promise<void> {
        await this.inner.set(
            key,
            encryptStoreValue(this.secret, value, this.keyContext),
            options,
        );
    }

    async delete(key: string): Promise<void> {
        await this.inner.delete(key);
    }
}
