import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { EncryptedKeyValueStore } from "../app/lib/server/store-crypto.ts";

const SMOKE_FILE = join(process.cwd(), ".data", "session-store-smoke.json");
const SMOKE_TAMPER_FILE = join(process.cwd(), ".data", "session-store-smoke-tamper.json");
const SECRET = "smoke-secret-with-32-plus-characters-000";
const WRONG_SECRET = "another-secret-that-is-also-long-enough-000";

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`ok - ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Minimal file-backed string store mirroring the prod FileKeyValueStore
 * contract (JSON file, TTL entries, tmp+rename writes) so the smoke proves
 * the on-disk representation contains no plaintext.
 */
class FileStringStore {
  constructor(path) {
    this.path = path;
    this.map = new Map();
    this.loaded = false;
  }

  load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!existsSync(this.path)) return;
      const parsed = JSON.parse(readFileSync(this.path, "utf8"));
      for (const [key, entry] of Object.entries(parsed)) {
        if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) continue;
        this.map.set(key, entry);
      }
    } catch {
      this.map = new Map();
    }
  }

  persist() {
    const payload = {};
    for (const [key, entry] of this.map) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) continue;
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

  get(key) {
    this.load();
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      this.persist();
      return undefined;
    }
    return entry.value;
  }

  set(key, value, options = {}) {
    this.load();
    this.map.set(key, {
      value,
      expiresAt:
        options.ttlMs !== undefined ? Date.now() + options.ttlMs : undefined,
    });
    this.persist();
  }

  delete(key) {
    this.load();
    this.map.delete(key);
    this.persist();
  }
}

function cleanup() {
  try {
    if (existsSync(SMOKE_FILE)) unlinkSync(SMOKE_FILE);
    if (existsSync(SMOKE_TAMPER_FILE)) unlinkSync(SMOKE_TAMPER_FILE);
  } catch {
    // Ignore cleanup errors.
  }
}

async function main() {
  cleanup();
  const rawStore = new FileStringStore(SMOKE_FILE);
  const store = new EncryptedKeyValueStore(rawStore, SECRET);

  const session = {
    id: "sess-1",
    accessToken: "sk-plaintext-access-token-smoke",
    refreshToken: "rt-plaintext-refresh-token-smoke",
    expiresAt: Date.now() + 3600_000,
  };

  await store.set("sess-1", session);

  check(
    "round-trips a stored session",
    JSON.stringify(await store.get("sess-1")) === JSON.stringify(session),
  );

  const raw = readFileSync(SMOKE_FILE, "utf8");
  check(
    "raw store contains only encrypted payloads",
    raw.includes("enc:v1:") && !raw.includes("sk-plaintext-access-token-smoke"),
    "file leaked plaintext tokens",
  );
  check(
    "raw store has no plaintext session fields",
    !raw.includes('"accessToken"') && !raw.includes('"refreshToken"'),
    "file contains plaintext session fields",
  );

  const tampered = raw.replace("enc:v1:", "enc:v1:A");
  if (raw !== tampered) {
    writeFileSync(SMOKE_TAMPER_FILE, tampered, { mode: 0o600 });
    const tamperStore = new EncryptedKeyValueStore(
      new FileStringStore(SMOKE_TAMPER_FILE),
      SECRET,
    );
    check(
      "tampered ciphertext fails authentication",
      (await tamperStore.get("sess-1")) === undefined,
    );
    unlinkSync(SMOKE_TAMPER_FILE);
  }

  const wrongKeyStore = new EncryptedKeyValueStore(
    new FileStringStore(SMOKE_FILE),
    WRONG_SECRET,
  );
  check(
    "wrong secret yields no session instead of a crash",
    (await wrongKeyStore.get("sess-1")) === undefined,
  );

  await store.delete("sess-1");
  check("delete removes the session", (await store.get("sess-1")) === undefined);

  await store.set("ttl-session", { token: "sk-ttl" }, { ttlMs: 50 });
  check("set applies the ttl", (await store.get("ttl-session")) !== undefined);
  await sleep(80);
  check(
    "expired ttl session is gone",
    (await store.get("ttl-session")) === undefined,
  );

  const legacyStore = new FileStringStore(SMOKE_FILE);
  legacyStore.set("legacy-session", JSON.stringify({
    accessToken: "sk-legacy-plaintext-smoke",
    refreshToken: "rt-legacy-plaintext-smoke",
  }));
  const migrationStore = new EncryptedKeyValueStore(legacyStore, SECRET);
  check(
    "legacy plaintext session is unreadable",
    (await migrationStore.get("legacy-session")) === undefined,
  );
  check(
    "legacy plaintext session is removed from the store",
    legacyStore.get("legacy-session") === undefined,
  );
  const afterCleanup = readFileSync(SMOKE_FILE, "utf8");
  check(
    "legacy plaintext is gone from the raw store",
    !afterCleanup.includes("sk-legacy-plaintext-smoke"),
  );

  cleanup();
  if (failures > 0) {
    console.error(`\n${failures} session-store smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll session-store checks passed.");
}

main().catch((error) => {
  cleanup();
  console.error(error);
  process.exit(1);
});