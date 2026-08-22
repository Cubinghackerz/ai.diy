import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { MemoryStore, type KeyValueStore } from "@opencoredev/loginwithchatgpt-core";
import { Redis } from "@upstash/redis";
import { EncryptedKeyValueStore } from "~/lib/server/store-crypto";

const DATA_DIR = join(process.cwd(), ".data");
const SECRET_PATH = join(DATA_DIR, "lwc-secret");

export function isServerlessRuntime(): boolean {
    return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function ensureDataDir() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

/**
 * Stable cookie-signing secret for local / single-node self-host.
 * Prefer LWC_SECRET. Otherwise persist a generated secret so ChatGPT
 * sessions survive `npm start` restarts.
 */
export function resolveChatGPTSecret(): string {
    const fromEnv = process.env.LWC_SECRET?.trim();
    if (fromEnv) return fromEnv;
    if (isServerlessRuntime()) {
        console.warn(
            "[chatgpt] LWC_SECRET is not set on a serverless runtime. Set it in Vercel so the session cookie remains valid across instances.",
        );
        return randomBytes(32).toString("hex");
    }
    try {
        ensureDataDir();
        if (existsSync(SECRET_PATH)) {
            const stored = readFileSync(SECRET_PATH, "utf8").trim();
            if (stored.length >= 32) return stored;
        }
        const generated = randomBytes(32).toString("hex");
        writeFileSync(SECRET_PATH, `${generated}\n`, { mode: 0o600 });
        console.info(
            "[chatgpt] Wrote a local session secret to .data/lwc-secret so ChatGPT login survives restarts. Set LWC_SECRET for multi-instance production.",
        );
        return generated;
    } catch (error) {
        console.warn(
            "[chatgpt] Could not persist a local session secret; ChatGPT login will reset on restart.",
            error instanceof Error ? error.message : error,
        );
        return randomBytes(32).toString("hex");
    }
}

/**
 * Redis-backed KeyValueStore for serverless deployments. Upstash's REST client
 * uses HTTP, so it works in Vercel functions without a long-lived TCP socket.
 */
export class RedisKeyValueStore<T> implements KeyValueStore<T> {
    constructor(
        private readonly redis: Redis,
        private readonly prefix = "ai.diy:",
    ) {}

    private key(key: string): string {
        return `${this.prefix}${key}`;
    }

    async get(key: string): Promise<T | undefined> {
        const value = await this.redis.get<T>(this.key(key));
        return value ?? undefined;
    }

    async set(key: string, value: T, options: { ttlMs?: number } = {}): Promise<void> {
        if (options.ttlMs !== undefined) {
            await this.redis.set(this.key(key), value, {
                px: Math.max(1, Math.ceil(options.ttlMs)),
            });
            return;
        }
        await this.redis.set(this.key(key), value);
    }

    async delete(key: string): Promise<void> {
        await this.redis.del(this.key(key));
    }
}

/**
 * Select storage by runtime: Redis when configured, memory on serverless
 * without Redis (never the read-only deployment filesystem), and the durable
 * local JSON store for Node/Docker. Persistent stores are wrapped with
 * AES-256-GCM at-rest encryption (see store-crypto).
 */
export function resolveChatGPTSessionStore<T>(filename: string): KeyValueStore<T> {
    const redisUrl =
        process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
    const redisToken =
        process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
    const secret = resolveChatGPTSecret();

    if (redisUrl && redisToken) {
        console.info("[chatgpt] Using Upstash Redis for session persistence.");
        return new EncryptedKeyValueStore<T>(
            new RedisKeyValueStore<string>(
                new Redis({ url: redisUrl, token: redisToken }),
                `ai.diy:${filename}:`,
            ),
            secret,
        );
    }

    if (isServerlessRuntime()) {
        console.warn(
            "[chatgpt] No Redis REST credentials found; using in-memory sessions for this serverless instance. Configure Upstash Redis for reliable logins across cold starts.",
        );
        return new MemoryStore<T>();
    }

    return new EncryptedKeyValueStore<T>(
        new FileKeyValueStore<string>(filename),
        secret,
    );
}

interface FileStoreEntry<T> {
    value: T;
    expiresAt?: number;
}

/**
 * Single-node JSON key/value store. Enough for local Docker/Node so ChatGPT
 * sessions survive process restarts. Multi-instance hosts still need Redis/KV.
 */
export class FileKeyValueStore<T> implements KeyValueStore<T> {
    private readonly path: string;
    private readonly now: () => number;
    private map = new Map<string, FileStoreEntry<T>>();
    private loaded = false;

    constructor(filename: string, options: { now?: () => number } = {}) {
        this.path = join(DATA_DIR, filename);
        this.now = options.now ?? Date.now;
    }

    private load() {
        if (this.loaded) return;
        this.loaded = true;
        try {
            if (!existsSync(this.path)) return;
            const parsed = JSON.parse(readFileSync(this.path, "utf8")) as Record<
                string,
                FileStoreEntry<T>
            >;
            for (const [key, entry] of Object.entries(parsed)) {
                if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) continue;
                this.map.set(key, entry);
            }
        } catch {
            this.map = new Map();
        }
    }

    private persist() {
        ensureDataDir();
        const payload: Record<string, FileStoreEntry<T>> = {};
        for (const [key, entry] of this.map) {
            if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) continue;
            payload[key] = entry;
        }
        const next = `${JSON.stringify(payload)}\n`;
        const tmp = `${this.path}.${process.pid}.tmp`;
        writeFileSync(tmp, next, { mode: 0o600 });
        try {
            renameSync(tmp, this.path);
        } catch {
            writeFileSync(this.path, next, { mode: 0o600 });
        }
    }

    get(key: string): T | undefined {
        this.load();
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) {
            this.map.delete(key);
            this.persist();
            return undefined;
        }
        return entry.value;
    }

    set(key: string, value: T, options: { ttlMs?: number } = {}): void {
        this.load();
        this.map.set(key, {
            value,
            expiresAt: options.ttlMs !== undefined ? this.now() + options.ttlMs : undefined,
        });
        this.persist();
    }

    delete(key: string): void {
        this.load();
        this.map.delete(key);
        this.persist();
    }
}
