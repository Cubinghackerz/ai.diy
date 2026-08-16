import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load `.env` / `.env.local` into process.env for the production server
 * (`npm start`), which otherwise never sees env files. Real environment
 * variables always win; `.env.local` overrides `.env`.
 *
 * Dev mode (`npm run dev`) does not need this — the React Router Vite
 * plugin already injects loaded env files into process.env.
 */
export function loadLocalEnvFiles(): void {
    for (const name of [".env", ".env.local"]) {
        const file = join(process.cwd(), name);
        if (!existsSync(file)) continue;
        let text: string;
        try {
            text = readFileSync(file, "utf8");
        } catch {
            continue;
        }
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#")) continue;
            const eq = line.indexOf("=");
            if (eq <= 0) continue;
            const key = line.slice(0, eq).trim();
            let value = line.slice(eq + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            if (key && process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    }
}