import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { KeyValueStore } from "@opencoredev/loginwithchatgpt-core";

const DATA_DIR = join(process.cwd(), ".data");
const SECRET_PATH = join(DATA_DIR, "lwc-secret");

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