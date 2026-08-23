/**
 * Computer Mode filesystem layer — thin wrappers over the in-browser CheerpX
 * VM (same scope/overlay the chat Linux tools use).
 */

import {
    bootCheerpX,
    cheerpxAvailable,
    readFileFromVM,
    runCommand,
} from "~/lib/cheerpx";

export type ComputerFsEntry = {
    name: string;
    dir: boolean;
    size: number;
    mtime: number;
};

export type ComputerFsResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string };

const MAX_WRITE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_PREVIEW = 64 * 1024;

function asError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function withVm<T>(
    scopeId: string,
    fn: (cx: Awaited<ReturnType<typeof bootCheerpX>>) => Promise<T>,
): Promise<ComputerFsResult<T>> {
    if (!cheerpxAvailable()) {
        return {
            ok: false,
            error:
                "This tab is not cross-origin isolated. Open the workspace as a top-level window over HTTPS or localhost.",
        };
    }
    try {
        const cx = await bootCheerpX(scopeId);
        return { ok: true, data: await fn(cx) };
    } catch (error) {
        return { ok: false, error: asError(error) };
    }
}

function shellEscape(value: string): string {
    return `'${value.replaceAll("'", "'\\''")}'`;
}

const LIST_SCRIPT = `python3 -c 'import json,os,sys;base=sys.argv[1];base=(base if base.rstrip("/") else "/");rows=[]
for n in sorted(os.listdir(base)):
  p=os.path.join(base,n)
  d=os.path.isdir(p)
  rows.append({"name":n,"dir":d,"size":(os.path.getsize(p) if not d else 0),"mtime":(os.path.getmtime(p) if not d else 0)})
print(json.dumps(rows))' $1`;

export async function listDirectory(
    scopeId: string,
    path: string,
): Promise<ComputerFsResult<ComputerFsEntry[]>> {
    const dir = `/${path.replace(/^\/+/, "")}`;
    return withVm(scopeId, async (cx) => {
        const result = await runCommand(cx, `set -- ${shellEscape(dir)}; ${LIST_SCRIPT}`, {
            cwd: "/",
            timeoutSec: 20,
        });
        if (result.exitCode !== 0 || !result.stdout.trim()) {
            return [] satisfies ComputerFsEntry[];
        }
        const start = result.stdout.indexOf("[");
        if (start < 0) return [] satisfies ComputerFsEntry[];
        const end = result.stdout.lastIndexOf("]");
        if (end <= start) return [] satisfies ComputerFsEntry[];
        try {
            const parsed = JSON.parse(result.stdout.slice(start, end + 1)) as unknown;
            if (!Array.isArray(parsed)) return [] satisfies ComputerFsEntry[];
            return parsed
                .filter(
                    (item): item is ComputerFsEntry =>
                        Boolean(item) &&
                        typeof (item as ComputerFsEntry).name === "string",
                )
                .map((item) => ({
                    name: item.name.slice(0, 200),
                    dir: Boolean(item.dir),
                    size: Number(item.size) || 0,
                    mtime: Number(item.mtime) || 0,
                }));
        } catch {
            return [] satisfies ComputerFsEntry[];
        }
    });
}

export async function readTextFile(
    scopeId: string,
    path: string,
): Promise<ComputerFsResult<string>> {
    return withVm(scopeId, async (cx) => {
        if (path.endsWith("/")) {
            return "";
        }
        const maxBytes = Math.min(MAX_TEXT_PREVIEW, MAX_WRITE_BYTES);
        const result = await runCommand(
            cx,
            `python3 -c 'import sys;print(open(sys.argv[1],encoding="utf-8",errors="replace").read(int(sys.argv[2])))' ${shellEscape(path)} ${String(maxBytes)}`,
            { cwd: "/home/user", timeoutSec: 20 },
        );
        if (result.exitCode !== 0) {
            throw new Error(result.stderr || "Could not read the file.");
        }
        return result.stdout;
    });
}

export async function readFileBytes(
    scopeId: string,
    path: string,
): Promise<ComputerFsResult<{ bytes: Uint8Array; name: string }>> {
    return withVm(scopeId, async (cx) => {
        const result = await readFileFromVM(cx, path, MAX_WRITE_BYTES);
        const artifact = result.artifacts[0];
        if (!artifact) throw new Error(result.output);
        const binary = atob(artifact.content);
        return {
            bytes: Uint8Array.from(binary, (ch) => ch.charCodeAt(0)),
            name: artifact.filename,
        };
    });
}

export async function writeFile(
    scopeId: string,
    path: string,
    bytes: Uint8Array,
): Promise<ComputerFsResult<void>> {
    if (bytes.byteLength > MAX_WRITE_BYTES) {
        return {
            ok: false,
            error: `File exceeds the ${MAX_WRITE_BYTES / 1024 / 1024} MiB workspace limit.`,
        };
    }
    let binary = "";
    for (const value of bytes) {
        binary += String.fromCharCode(value);
    }
    const b64 = btoa(binary);
    const chunk = 64 * 1024;
    return withVm(scopeId, async (cx) => {
        const initial = `python3 -c 'import base64,sys;open(sys.argv[1],"wb").write(base64.b64decode(sys.argv[2]))' ${shellEscape(path)} ${shellEscape(b64.slice(0, chunk))}`;
        await runCommand(cx, initial, { cwd: "/home/user", timeoutSec: 30 });
        for (let offset = chunk; offset < b64.length; offset += chunk) {
            const part = b64.slice(offset, offset + chunk);
            const append = `python3 -c 'import base64,sys;f=open(sys.argv[1],"ab");f.write(base64.b64decode(sys.argv[2]))' ${shellEscape(path)} ${shellEscape(part)}`;
            await runCommand(cx, append, { cwd: "/home/user", timeoutSec: 30 });
        }
    });
}

export async function mkdir(
    scopeId: string,
    path: string,
): Promise<ComputerFsResult<void>> {
    return withVm(scopeId, async (cx) => {
        const result = await runCommand(cx, `mkdir -p -- ${shellEscape(path)}`, {
            cwd: "/home/user",
            timeoutSec: 20,
        });
        if (result.exitCode !== 0) throw new Error(result.stderr || "mkdir failed.");
    });
}

export async function removePath(
    scopeId: string,
    path: string,
): Promise<ComputerFsResult<void>> {
    return withVm(scopeId, async (cx) => {
        const result = await runCommand(cx, `rm -rf -- ${shellEscape(path)}`, {
            cwd: "/home/user",
            timeoutSec: 20,
        });
        if (result.exitCode !== 0) throw new Error(result.stderr || "Delete failed.");
    });
}

export async function renamePath(
    scopeId: string,
    from: string,
    to: string,
): Promise<ComputerFsResult<void>> {
    return withVm(scopeId, async (cx) => {
        const result = await runCommand(cx, `mv -- ${shellEscape(from)} ${shellEscape(to)}`, {
            cwd: "/home/user",
            timeoutSec: 20,
        });
        if (result.exitCode !== 0) throw new Error(result.stderr || "Rename failed.");
    });
}

export async function recentFiles(
    scopeId: string,
): Promise<ComputerFsResult<ComputerFsEntry[]>> {
    return withVm(scopeId, async (cx) => {
        const result = await runCommand(
            cx,
            `find /home/user -type f -not -path "*/node_modules/*" -not -path "*/.cache/*" -not -path "*/.npm/*" -not -path "*/.local/*" -not -path "*/.aidiy-bg/*" -not -path "*/.*" -printf '%T@\\t%s\\t%p\\n' 2>/dev/null | sort -rn | head -30`,
            { cwd: "/", timeoutSec: 20 },
        );
        if (result.exitCode !== 0) return [] satisfies ComputerFsEntry[];
        const entries: ComputerFsEntry[] = [];
        for (const line of result.stdout.split("\n")) {
            const match = /^([0-9.]+)\t(\d+)\t(.+)$/.exec(line.trim());
            if (!match) continue;
            entries.push({
                name: match[3].split("/").pop() || match[3],
                dir: false,
                size: Number(match[2]) || 0,
                mtime: Number(match[1]) || 0,
            });
        }
        return entries;
    });
}

export function workspaceHome(): string {
    return "/home/user";
}

export function joinScopePath(base: string, name: string): string {
    const clean = name.replace(/[\\/]/g, "_");
    return `${base.replace(/\/+$/, "")}/${clean}`;
}