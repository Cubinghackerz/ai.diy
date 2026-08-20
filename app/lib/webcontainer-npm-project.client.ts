import type { FileSystemTree } from "@webcontainer/api";
import type { LinuxArtifact, LinuxClientResult } from "~/lib/cheerpx";
import {
    normalizeNpmProjectName,
    normalizeProjectFilePath,
    planNpmProject,
    validateNpmPackageSpecs,
    type NpmProjectInput,
} from "~/lib/npm-project";

const MAX_OUTPUT_BYTES = 32 * 1024;
const MAX_READ_BYTES = 2 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024;
const PROJECTS_ROOT = "/projects";

let webContainerPromise: Promise<import("@webcontainer/api").WebContainer> | null = null;

function scopeKey(scopeId: string): string {
    const value = String(scopeId ?? "draft")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .slice(0, 48);
    return value || "draft";
}

function projectPath(project: string, scopeId: string): string {
    return `${PROJECTS_ROOT}/${scopeKey(scopeId)}/${normalizeNpmProjectName(project)}`;
}

async function getWebContainer() {
    if (typeof window === "undefined") {
        throw new Error("WebContainers are only available in the browser.");
    }
    if (!webContainerPromise) {
        webContainerPromise = import("@webcontainer/api")
            .then(({ WebContainer }) => WebContainer.boot({
                coep: "credentialless",
                workdirName: "ai-diy",
            }))
            .catch((error) => {
                webContainerPromise = null;
                throw error;
            });
    }
    return webContainerPromise;
}

async function ensureProjectDirectory(
    container: Awaited<ReturnType<typeof getWebContainer>>,
    root: string,
): Promise<void> {
    await container.fs.mkdir(root, { recursive: true });
}

async function fileExists(
    container: Awaited<ReturnType<typeof getWebContainer>>,
    path: string,
): Promise<boolean> {
    try {
        await container.fs.readFile(path);
        return true;
    } catch {
        return false;
    }
}

async function writeProjectFiles(
    container: Awaited<ReturnType<typeof getWebContainer>>,
    root: string,
    files: Record<string, string>,
): Promise<void> {
    for (const [relativePath, content] of Object.entries(files)) {
        const normalized = normalizeProjectFilePath(relativePath);
        const path = `${root}/${normalized}`;
        const parent = path.slice(0, path.lastIndexOf("/"));
        await container.fs.mkdir(parent, { recursive: true });
        await container.fs.writeFile(path, content);
    }
}

async function collectProcessOutput(
    process: import("@webcontainer/api").WebContainerProcess,
): Promise<string> {
    const reader = process.output.getReader();
    let output = "";
    try {
        while (true) {
            const next = await reader.read();
            if (next.done) break;
            output += next.value;
            if (output.length > MAX_OUTPUT_BYTES) {
                await reader.cancel().catch(() => undefined);
                return `${output.slice(0, MAX_OUTPUT_BYTES)}\n[truncated: output exceeded 32KB]`;
            }
        }
    } finally {
        reader.releaseLock();
    }
    return output;
}

async function runProcess(
    container: Awaited<ReturnType<typeof getWebContainer>>,
    command: string,
    args: string[],
    cwd: string,
    timeoutSec: number,
): Promise<LinuxClientResult> {
    const startedAt = Date.now();
    const process = await container.spawn(command, args, { cwd });
    const outputPromise = collectProcessOutput(process);
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<number>((resolve) => {
        timeoutId = setTimeout(() => {
            timedOut = true;
            process.kill();
            resolve(124);
        }, timeoutSec * 1000);
    });
    const exitCode = await Promise.race([process.exit, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    const output = await (timedOut
        ? Promise.race([
              outputPromise,
              new Promise<string>((resolve) => setTimeout(() => resolve(""), 5_000)),
          ])
        : outputPromise
    ).catch((error) => String(error));
    return {
        output: `${output ? `stdout:\n${output}\n\n` : ""}exitCode: ${exitCode}\n${timedOut ? "\ntimedOut: true\n" : "\n"}durationMs: ${Date.now() - startedAt}`,
        artifacts: [],
    };
}

function base64Encode(bytes: Uint8Array): string {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32_768) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
    }
    return btoa(binary);
}

function tarHeader(name: string, size: number, mode: number, type: number): Uint8Array {
    const header = new Uint8Array(512);
    const encoder = new TextEncoder();
    const write = (offset: number, length: number, value: string) => {
        header.set(encoder.encode(value).subarray(0, length), offset);
    };
    const encodedName = encoder.encode(name);
    let namePart = name;
    let prefixPart = "";
    if (encodedName.length > 100) {
        for (let split = name.lastIndexOf("/"); split > 0; split = name.lastIndexOf("/", split - 1)) {
            const candidateName = name.slice(split + 1);
            const candidatePrefix = name.slice(0, split);
            if (encoder.encode(candidateName).length <= 100 && encoder.encode(candidatePrefix).length <= 155) {
                namePart = candidateName;
                prefixPart = candidatePrefix;
                break;
            }
        }
    }
    const encodedNamePart = encoder.encode(namePart);
    const encodedPrefixPart = encoder.encode(prefixPart);
    if (encodedNamePart.length > 100 || encodedPrefixPart.length > 155) {
        throw new Error(`Archive path is too long: ${name}`);
    }
    header.set(encodedNamePart, 0);
    write(100, 8, `${(mode & 0o7777).toString(8).padStart(7, "0")}\0`);
    write(108, 8, "0000000\0");
    write(116, 8, "0000000\0");
    write(124, 12, `${size.toString(8).padStart(11, "0")}\0`);
    write(136, 12, "00000000000\0");
    write(148, 8, "        ");
    header[156] = type;
    write(257, 6, "ustar\0");
    write(263, 2, "00");
    write(265, 32, "user");
    write(297, 32, "user");
    if (encodedPrefixPart.length) header.set(encodedPrefixPart, 345);
    let checksum = 0;
    for (const byte of header) checksum += byte;
    write(148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
    return header;
}

function treeTar(tree: FileSystemTree): Uint8Array {
    const parts: Uint8Array[] = [];
    const encoder = new TextEncoder();
    const append = (path: string, node: FileSystemTree[string]) => {
        if ("directory" in node) {
            if (path) parts.push(tarHeader(`${path}/`, 0, 0o755, 53));
            for (const [name, child] of Object.entries(node.directory)) {
                if (name === "node_modules") continue;
                append(path ? `${path}/${name}` : name, child);
            }
            return;
        }
        if (!("file" in node) || "symlink" in node.file) return;
        const content = typeof node.file.contents === "string"
            ? encoder.encode(node.file.contents)
            : node.file.contents;
        parts.push(tarHeader(path, content.byteLength, 0o644, 48));
        parts.push(content);
        const padding = (512 - (content.byteLength % 512)) % 512;
        if (padding) parts.push(new Uint8Array(padding));
    };
    for (const [name, node] of Object.entries(tree)) {
        if (name !== "node_modules") append(name, node);
    }
    parts.push(new Uint8Array(1024));
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    if (total > MAX_ARCHIVE_BYTES) {
        throw new Error(`Export exceeds the ${MAX_ARCHIVE_BYTES}-byte artifact limit.`);
    }
    const archive = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        archive.set(part, offset);
        offset += part.byteLength;
    }
    return archive;
}

async function snapshotDirectory(
    container: Awaited<ReturnType<typeof getWebContainer>>,
    path: string,
): Promise<FileSystemTree> {
    const tree: FileSystemTree = {};
    const entries = await container.fs.readdir(path, { withFileTypes: true });
    for (const entry of entries) {
        const name = String(entry.name);
        if (name === "node_modules") continue;
        const childPath = `${path}/${name}`;
        if (entry.isDirectory()) {
            tree[name] = { directory: await snapshotDirectory(container, childPath) };
        } else if (entry.isFile()) {
            tree[name] = { file: { contents: await container.fs.readFile(childPath) } };
        }
    }
    return tree;
}

async function inspectProject(
    container: Awaited<ReturnType<typeof getWebContainer>>,
    root: string,
): Promise<string> {
    const packageJson = await container.fs.readFile(`${root}/package.json`, "utf-8");
    let packages: string[] = [];
    try {
        packages = (await container.fs.readdir(`${root}/node_modules`))
            .filter((name) => name !== ".bin" && !name.startsWith("."))
            .sort();
    } catch {
        // No install has been run yet.
    }
    return `--- package.json ---\n${packageJson}\n--- installed top-level packages ---\n${packages.join("\n")}`;
}

export async function executeWebContainerNpmProjectTool(
    input: NpmProjectInput,
    scopeId: string,
): Promise<LinuxClientResult> {
    const plan = planNpmProject(input);
    const container = await getWebContainer();
    const root = projectPath(input.project, scopeId);
    await ensureProjectDirectory(container, root);

    if (input.action === "init") {
        if (!(await fileExists(container, `${root}/package.json`))) {
            await container.fs.writeFile(
                `${root}/package.json`,
                JSON.stringify({
                    name: normalizeNpmProjectName(input.project),
                    private: true,
                    version: "0.0.0",
                    scripts: {},
                }, null, 2),
            );
        }
        return { output: "exitCode: 0\n\ndurationMs: 0", artifacts: [] };
    }
    if (input.action === "write") {
        await writeProjectFiles(container, root, input.files ?? {});
        return { output: "exitCode: 0\n\ndurationMs: 0", artifacts: [] };
    }
    if (input.action === "read") {
        const path = `${root}/${normalizeProjectFilePath(input.path ?? "")}`;
        const bytes = await container.fs.readFile(path);
        if (bytes.byteLength > MAX_READ_BYTES) {
            throw new Error(`File exceeds the ${MAX_READ_BYTES}-byte read limit.`);
        }
        const filename = normalizeProjectFilePath(input.path ?? "").split("/").pop() ?? "file";
        const artifact: LinuxArtifact = {
            filename,
            content: base64Encode(bytes),
            contentEncoding: "base64",
        };
        return { output: `Read ${filename} from the WebContainer.`, artifacts: [artifact] };
    }
    if (input.action === "inspect") {
        return { output: `${await inspectProject(container, root)}\n\nexitCode: 0`, artifacts: [] };
    }
    if (input.action === "export") {
        const tree = await snapshotDirectory(container, root);
        const artifact: LinuxArtifact = {
            filename: `${normalizeNpmProjectName(input.project)}.tar`,
            content: base64Encode(treeTar(tree)),
            contentEncoding: "base64",
        };
        return { output: "exitCode: 0\n\ndurationMs: 0", artifacts: [artifact] };
    }
    if (plan.kind !== "command") {
        throw new Error("Invalid WebContainer npm project plan.");
    }
    const args = input.action === "install"
        ? ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", "--", ...validateNpmPackageSpecs(input.packages)]
        : ["run", String(input.script ?? "")];
    return runProcess(container, "npm", args, root, 300);
}
