/**
 * Validation and command planning for browser-local npm projects.
 *
 * This module validates browser-local project operations. The client adapter
 * executes them in WebContainers; it must never be used by a server route to
 * execute npm on the ai.diy host.
 */

export const NPM_PROJECT_ROOT = "/home/user/projects";
export const MAX_NPM_PROJECT_NAME_LENGTH = 48;
export const MAX_NPM_PROJECT_FILES = 48;
export const MAX_NPM_PROJECT_FILE_BYTES = 200_000;
export const MAX_NPM_PROJECT_TOTAL_BYTES = 1_000_000;
export const MAX_NPM_PACKAGE_SPECS = 12;
export const NPM_PROJECT_SCRIPTS = [
    "build",
    "dev",
    "start",
    "preview",
    "test",
    "lint",
    "typecheck",
    "check",
    "format",
] as const;

export const NPM_PROJECT_ACTIONS = [
    "init",
    "write",
    "install",
    "run",
    "read",
    "inspect",
    "export",
] as const;

export type NpmProjectAction = (typeof NPM_PROJECT_ACTIONS)[number];

export type NpmProjectInput = {
    action: NpmProjectAction;
    project: string;
    files?: Record<string, string>;
    packages?: string[];
    script?: string;
    path?: string;
};

export type NpmProjectPlan =
    | { kind: "command"; command: string; cwd: string }
    | { kind: "read"; path: string }
    | { kind: "export"; archivePath: string; command: string; cwd: string };

const PACKAGE_SPEC_RE =
    /^(?:@[a-z0-9._-]+\/[a-z0-9._-]+|[a-z0-9._-]+)(?:@[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9a-z.-]+)?)?$/i;
const SCRIPT_RE = /^[a-z0-9][a-z0-9:_-]{0,63}$/i;
const PROJECT_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,47}$/i;
const NPM_PROJECT_HELPER_PATH = "/home/user/.aidiy/npm-project-helper.py";
const NPM_PROJECT_HELPER = `import os
import sys

action = sys.argv[1]
root = sys.argv[2]

def tar_header(name, size, mode, mtime, kind):
    encoded = name.encode("utf-8")
    prefix = b""
    if len(encoded) > 100:
        split = encoded.rfind(b"/", 0, 156)
        if split < 1 or len(encoded) - split - 1 > 100:
            raise ValueError("Archive path is too long: " + name)
        prefix, encoded = encoded[:split], encoded[split + 1:]
    block = bytearray(512)
    block[0:len(encoded)] = encoded
    block[100:108] = ("%07o\\0" % (mode & 0o7777)).encode()
    block[108:116] = b"0000000\\0"
    block[116:124] = b"0000000\\0"
    block[124:136] = ("%011o\\0" % size).encode()
    block[136:148] = ("%011o\\0" % int(mtime)).encode()
    block[148:156] = b"        "
    block[156:157] = kind
    block[257:263] = b"ustar\\0"
    block[263:265] = b"00"
    block[265:269] = b"user"
    block[297:301] = b"user"
    block[345:345 + len(prefix)] = prefix
    block[148:156] = ("%06o\\0 " % sum(block)).encode()
    return block

if action == "inspect":
    print("--- package.json ---")
    with open(os.path.join(root, "package.json"), encoding="utf-8") as package_file:
        print(package_file.read())
    print("--- installed top-level packages ---")
    modules = os.path.join(root, "node_modules")
    if os.path.isdir(modules):
        for name in sorted(item for item in os.listdir(modules) if not item.startswith(".")):
            if name.startswith("@"):
                scope = os.path.join(modules, name)
                for package in sorted(os.listdir(scope)):
                    print(name + "/" + package)
            else:
                print(name)
elif action == "export":
    archive = sys.argv[3]
    if os.path.exists(archive):
        os.unlink(archive)
    with open(archive, "wb") as output:
        for current, directories, filenames in os.walk(root):
            directories[:] = sorted(name for name in directories if name != "node_modules")
            relative = os.path.relpath(current, root)
            if relative != ".":
                stat = os.stat(current)
                output.write(tar_header(relative + "/", 0, stat.st_mode, stat.st_mtime, b"5"))
            for filename in sorted(filenames):
                path = os.path.join(current, filename)
                if os.path.islink(path):
                    continue
                name = os.path.relpath(path, root)
                stat = os.stat(path)
                output.write(tar_header(name, stat.st_size, stat.st_mode, stat.st_mtime, b"0"))
                with open(path, "rb") as source:
                    while True:
                        chunk = source.read(65536)
                        if not chunk:
                            break
                        output.write(chunk)
                padding = (-stat.st_size) % 512
                if padding:
                    output.write(bytes(padding))
        output.write(bytes(1024))
else:
    raise SystemExit("Unknown npm project helper action: " + action)
`;

export function shellQuote(value: string): string {
    return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function normalizeNpmProjectName(value: string): string {
    const name = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, MAX_NPM_PROJECT_NAME_LENGTH);
    if (!PROJECT_NAME_RE.test(name) || name === "." || name === "..") {
        throw new Error(
            "Project name must contain only letters, numbers, dots, underscores, or hyphens.",
        );
    }
    return name;
}

export function projectRoot(project: string): string {
    return `${NPM_PROJECT_ROOT}/${normalizeNpmProjectName(project)}`;
}

export function normalizeProjectFilePath(value: string): string {
    const raw = String(value ?? "").trim().replaceAll("\\", "/");
    if (!raw || raw.startsWith("/") || raw.includes("\0")) {
        throw new Error(`Project file path is not relative: ${value}`);
    }
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length || parts.some((part) => part === "." || part === "..")) {
        throw new Error(`Project file path cannot escape the project root: ${value}`);
    }
    return parts.join("/");
}

export function validatePackageSpec(value: string): string {
    const spec = String(value ?? "").trim();
    if (!PACKAGE_SPEC_RE.test(spec)) {
        throw new Error(
            `Unsupported npm package spec: ${spec || "(empty)"}. Use a registry package name with an optional exact version, such as react@19.1.0.`,
        );
    }
    return spec;
}

export function validateNpmPackageSpecs(packages: string[] | undefined): string[] {
    const specs = (packages ?? []).map(validatePackageSpec);
    if (specs.length > MAX_NPM_PACKAGE_SPECS) {
        throw new Error(`You can install at most ${MAX_NPM_PACKAGE_SPECS} packages in one step.`);
    }
    return [...new Set(specs)];
}

function validateFiles(files: Record<string, string> | undefined): Array<[string, string]> {
    const entries = Object.entries(files ?? {}).map(([path, content]) => {
        const normalizedPath = normalizeProjectFilePath(path);
        const text = String(content ?? "");
        const bytes = new TextEncoder().encode(text).byteLength;
        if (bytes > MAX_NPM_PROJECT_FILE_BYTES) {
            throw new Error(
                `${normalizedPath} is too large. Each project file is limited to ${MAX_NPM_PROJECT_FILE_BYTES} bytes.`,
            );
        }
        return [normalizedPath, text] as [string, string];
    });
    if (entries.length > MAX_NPM_PROJECT_FILES) {
        throw new Error(`A project write can contain at most ${MAX_NPM_PROJECT_FILES} files.`);
    }
    const totalBytes = entries.reduce(
        (total, [, content]) => total + new TextEncoder().encode(content).byteLength,
        0,
    );
    if (totalBytes > MAX_NPM_PROJECT_TOTAL_BYTES) {
        throw new Error(
            `This project write is too large. The total file limit is ${MAX_NPM_PROJECT_TOTAL_BYTES} bytes.`,
        );
    }
    return entries;
}

function base64Utf8(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function decodeFileCommand(target: string, content: string): string {
    // The Debian image's base64 utility can corrupt CheerpX state before Node runs.
    const decoder = 'import base64,sys; open(sys.argv[2], "wb").write(base64.b64decode(sys.argv[1]))';
    return `python3 -c ${shellQuote(decoder)} ${shellQuote(base64Utf8(content))} ${shellQuote(target)}`;
}

function buildWriteCommand(root: string, files: Array<[string, string]>): string {
    const lines = ["set -eu", `mkdir -p -- ${shellQuote(root)}`];
    for (const [relativePath, content] of files) {
        const target = `${root}/${relativePath}`;
        const parent = target.slice(0, target.lastIndexOf("/"));
        lines.push(`mkdir -p -- ${shellQuote(parent)}`);
        lines.push(decodeFileCommand(target, content));
    }
    return lines.join("\n");
}

export function planNpmProject(input: NpmProjectInput): NpmProjectPlan {
    const root = projectRoot(input.project);
    switch (input.action) {
        case "init": {
            const packageJson = JSON.stringify(
                {
                    name: normalizeNpmProjectName(input.project),
                    private: true,
                    version: "0.0.0",
                    scripts: {},
                },
                null,
                2,
            );
            return {
                kind: "command",
                cwd: "/home/user",
                command: `set -eu\nmkdir -p -- ${shellQuote(root)} ${shellQuote("/home/user/.aidiy")}\nprintf %s ${shellQuote(NPM_PROJECT_HELPER)} > ${shellQuote(NPM_PROJECT_HELPER_PATH)}\nif [ ! -f ${shellQuote(`${root}/package.json`)} ]; then ${decodeFileCommand(`${root}/package.json`, packageJson)}; fi`,
            };
        }
        case "write": {
            const files = validateFiles(input.files);
            if (!files.length) throw new Error("The write action requires at least one project file.");
            return { kind: "command", cwd: "/home/user", command: buildWriteCommand(root, files) };
        }
        case "install": {
            const packages = validateNpmPackageSpecs(input.packages);
            if (!packages.length) throw new Error("The install action requires at least one package.");
            return {
                kind: "command",
                cwd: root,
                command: `set -eu\nnpm install --ignore-scripts --no-audit --no-fund --save-exact -- ${packages.map(shellQuote).join(" ")}`,
            };
        }
        case "run": {
            const script = String(input.script ?? "").trim();
            if (!SCRIPT_RE.test(script) || !NPM_PROJECT_SCRIPTS.includes(script as (typeof NPM_PROJECT_SCRIPTS)[number])) {
                throw new Error(
                    `Script must be one of: ${NPM_PROJECT_SCRIPTS.join(", ")}.`,
                );
            }
            return {
                kind: "command",
                cwd: root,
                command: `set -eu\nnpm run ${shellQuote(script)}`,
            };
        }
        case "read": {
            return { kind: "read", path: `${root}/${normalizeProjectFilePath(input.path ?? "")}` };
        }
        case "inspect": {
            return {
                kind: "command",
                cwd: root,
                command: `set -eu\n[ -f ${shellQuote(NPM_PROJECT_HELPER_PATH)} ] || { printf '%s\\n' 'Project helper is missing; run init first.' >&2; exit 2; }\npython3 ${shellQuote(NPM_PROJECT_HELPER_PATH)} inspect ${shellQuote(root)}`,
            };
        }
        case "export": {
            const archivePath = `/tmp/aidiy-${normalizeNpmProjectName(input.project)}.tar`;
            return {
                kind: "export",
                archivePath,
                cwd: NPM_PROJECT_ROOT,
                command: `set -eu\n[ -f ${shellQuote(NPM_PROJECT_HELPER_PATH)} ] || { printf '%s\\n' 'Project helper is missing; run init first.' >&2; exit 2; }\npython3 ${shellQuote(NPM_PROJECT_HELPER_PATH)} export ${shellQuote(root)} ${shellQuote(archivePath)}`,
            };
        }
    }
}
