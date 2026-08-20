let pyodidePromise: Promise<PyodideRuntime> | null = null;

type PyodideRuntime = {
    loadPackagesFromImports?: (code: string) => Promise<void>;
    loadPackage?: (packages: string | string[]) => Promise<void>;
    runPythonAsync: (code: string) => Promise<unknown>;
};

export type BrowserPythonArtifact = {
    filename: string;
    content: string;
    contentEncoding: "base64";
};

export type BrowserPythonResult = {
    output: string;
    artifacts: BrowserPythonArtifact[];
};

export type BrowserPythonInputFile = {
    filename: string;
    dataUrl: string;
};

type PyodideWindow = Window & {
    loadPyodide?: (options: { indexURL: string }) => Promise<PyodideRuntime>;
};

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
// Captured Python files stay in the active Canvas session rather than being
// written to IndexedDB. Keep their in-memory footprint deliberately bounded.
const MAX_PYTHON_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_PYTHON_ARTIFACTS = 4;
const MAX_PYTHON_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_PYTHON_INPUT_FILES = 4;

// Pyodide loads these only when the user's code imports the matching module.
// Keeping the map here makes common scientific, data, plotting, parsing,
// image, and document/file-creation workflows work without requiring a local
// Python installation.
const USEFUL_PACKAGE_ALIASES: Record<string, string> = {
    numpy: "numpy",
    pandas: "pandas",
    matplotlib: "matplotlib",
    scipy: "scipy",
    sympy: "sympy",
    sklearn: "scikit-learn",
    PIL: "pillow",
    networkx: "networkx",
    bs4: "beautifulsoup4",
    lxml: "lxml",
    regex: "regex",
    dateutil: "python-dateutil",
    yaml: "pyyaml",
    openpyxl: "openpyxl",
    xlsxwriter: "xlsxwriter",
    docx: "python-docx",
    pptx: "python-pptx",
    reportlab: "reportlab",
    fpdf: "fpdf2",
    jinja2: "jinja2",
    requests: "requests",
    pypdf: "pypdf",
};

// These useful file/document packages are not bundled in every Pyodide
// release. Install them lazily from PyPI when the user's code imports them.
const MICROPIP_PACKAGE_ALIASES: Record<string, string> = {
    openpyxl: "openpyxl",
    xlsxwriter: "XlsxWriter",
    docx: "python-docx",
    pptx: "python-pptx",
    reportlab: "reportlab",
    fpdf: "fpdf2",
    pypdf: "pypdf",
};

const micropipInstallPromises = new Map<string, Promise<void>>();

async function installWithMicropip(
    pyodide: PyodideRuntime,
    packageName: string,
): Promise<void> {
    const existing = micropipInstallPromises.get(packageName);
    if (existing) return existing;

    const install = (async () => {
        await pyodide.loadPackage?.("micropip");
        await pyodide.runPythonAsync(`
import micropip
await micropip.install(${JSON.stringify(packageName)})
        `);
    })()
        .catch((error) => {
            micropipInstallPromises.delete(packageName);
            throw error;
        });
    micropipInstallPromises.set(packageName, install);
    return install;
}

function loadPyodide(): Promise<PyodideRuntime> {
    if (pyodidePromise) return pyodidePromise;

    pyodidePromise = new Promise<PyodideRuntime>((resolve, reject) => {
        if (typeof window === "undefined" || typeof document === "undefined") {
            reject(new Error("Pyodide is only available in the browser."));
            return;
        }

        const finish = () => {
            const loader = (window as PyodideWindow).loadPyodide;
            if (!loader) {
                reject(new Error("Pyodide failed to load."));
                return;
            }
            loader({ indexURL: PYODIDE_BASE }).then(resolve, reject);
        };

        const existing = document.querySelector<HTMLScriptElement>(
            "script[data-prismium-pyodide]",
        );
        if (existing) {
            existing.crossOrigin = "anonymous";
            if ((window as PyodideWindow).loadPyodide) finish();
            else existing.addEventListener("load", finish, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.crossOrigin = "anonymous";
        script.src = `${PYODIDE_BASE}pyodide.js`;
        script.async = true;
        script.dataset.prismiumPyodide = "true";
        script.addEventListener("load", finish, { once: true });
        script.addEventListener(
            "error",
            () => reject(new Error("Unable to download the Pyodide runtime.")),
            { once: true },
        );
        document.head.appendChild(script);
    }).catch((error) => {
        pyodidePromise = null;
        throw error;
    });

    return pyodidePromise!;
}

function base64Payload(dataUrl: string): string | null {
    const comma = dataUrl.indexOf(",");
    if (comma < 0 || !/^data:[^;,]+(?:;[^;,]+)*;base64$/i.test(dataUrl.slice(0, comma))) {
        return null;
    }
    const payload = dataUrl.slice(comma + 1).replace(/\s+/g, "");
    return payload && payload.length <= Math.ceil((MAX_PYTHON_INPUT_BYTES * 4) / 3)
        ? payload
        : null;
}

export function collectPythonInputFiles(messages: unknown[]): BrowserPythonInputFile[] {
    const files: BrowserPythonInputFile[] = [];
    const seen = new Set<string>();
    for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const parts = (message as { parts?: unknown[] }).parts;
        if (!Array.isArray(parts)) continue;
        for (const part of parts) {
            if (!part || typeof part !== "object") continue;
            const value = part as {
                type?: unknown;
                filename?: unknown;
                data?: unknown;
                image?: unknown;
            };
            const dataUrl =
                typeof value.data === "string"
                    ? value.data
                    : typeof value.image === "string"
                      ? value.image
                      : "";
            const payload = base64Payload(dataUrl);
            const filename =
                typeof value.filename === "string" && value.filename.trim()
                    ? value.filename.trim().replace(/[\\/]/g, "_")
                    : value.type === "image"
                      ? "attachment-image.bin"
                      : "attachment.bin";
            if (!payload || seen.has(`${filename}:${payload.length}`)) continue;
            seen.add(`${filename}:${payload.length}`);
            files.push({ filename, dataUrl });
            if (files.length >= MAX_PYTHON_INPUT_FILES) return files;
        }
    }
    return files;
}

export async function runBrowserPython(
    code: string,
    inputFiles: BrowserPythonInputFile[] = [],
): Promise<BrowserPythonResult> {
    const source = String(code ?? "").trim();
    if (!source) {
        return { output: "Python error: no code provided.", artifacts: [] };
    }

    const pyodide = await loadPyodide();
    try {
        await pyodide.loadPackagesFromImports?.(source);
    } catch {
        // Alias loading below handles common import names such as sklearn and
        // PIL. Unknown imports are reported by Python with a useful traceback.
    }
    const importedModules = [
        ...new Set(
            [...source.matchAll(/^\s*(?:from|import)\s+([A-Za-z0-9_]+)/gm)]
                .map((match) => match[1])
                .filter((module): module is string => Boolean(module)),
        ),
    ];
    for (const module of importedModules) {
        const packageName = USEFUL_PACKAGE_ALIASES[module];
        if (!packageName) continue;
        try {
            await pyodide.loadPackage?.(packageName);
        } catch {
            const micropipPackage = MICROPIP_PACKAGE_ALIASES[module];
            if (!micropipPackage) {
                // Let Python return the import traceback if this optional
                // package is unavailable in the selected Pyodide release.
                continue;
            }
            try {
                await installWithMicropip(pyodide, micropipPackage);
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                return {
                    output: `Python error: The ${module} library could not be loaded automatically. Check the browser network connection and retry. ${reason.slice(0, 500)}`,
                    artifacts: [],
                };
            }
        }
    }

    const stagedFiles = inputFiles
        .slice(0, MAX_PYTHON_INPUT_FILES)
        .map((file) => {
            const payload = base64Payload(file.dataUrl);
            const filename = file.filename.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 160) || "attachment.bin";
            return payload ? { filename, payload } : null;
        })
        .filter((file): file is { filename: string; payload: string } => Boolean(file));
    const result = await pyodide.runPythonAsync(`
import ast
import base64
import contextlib
import io
import json
import os
import traceback

# Charts must be static files (PNG/SVG). Interactive matplotlib backends leave
# broken toolbars in Canvas iframes (missing icon CSS under about:blank).
try:
    import matplotlib
    matplotlib.use("Agg", force=True)
except BaseException:
    pass

_prismium_stdout = io.StringIO()
_prismium_stderr = io.StringIO()
_prismium_working_directory = os.getcwd()

_prismium_inputs = ${JSON.stringify(stagedFiles)}
for _prismium_input in _prismium_inputs:
    _prismium_input_path = os.path.join(_prismium_working_directory, _prismium_input["filename"])
    with open(_prismium_input_path, "wb") as _prismium_input_file:
        _prismium_input_file.write(base64.b64decode(_prismium_input["payload"]))
_prismium_input_payloads = {
    _prismium_input["filename"]: _prismium_input["payload"]
    for _prismium_input in _prismium_inputs
}

def _prismium_file_snapshot():
    snapshot = {}
    try:
        for filename in os.listdir(_prismium_working_directory):
            path = os.path.join(_prismium_working_directory, filename)
            if os.path.isfile(path):
                stat = os.stat(path)
                snapshot[filename] = (stat.st_size, stat.st_mtime)
    except BaseException:
        pass
    return snapshot

_prismium_before = _prismium_file_snapshot()
try:
    _prismium_code = compile(
        ${JSON.stringify(source)},
        "<user>",
        "exec",
        flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT,
    )

    async def _prismium_run():
        # eval returns the coroutine produced by PyCF_ALLOW_TOP_LEVEL_AWAIT;
        # exec discards it and causes unawaited-coroutine warnings.
        _prismium_coroutine = eval(_prismium_code, globals())
        if _prismium_coroutine is not None:
            await _prismium_coroutine

    with contextlib.redirect_stdout(_prismium_stdout), contextlib.redirect_stderr(_prismium_stderr):
        await _prismium_run()
    _prismium_result = {
        "stdout": _prismium_stdout.getvalue(),
        "stderr": _prismium_stderr.getvalue(),
        "error": None,
    }
except BaseException:
    _prismium_result = {
        "stdout": _prismium_stdout.getvalue(),
        "stderr": _prismium_stderr.getvalue(),
        "error": traceback.format_exc(),
    }

_prismium_artifacts = []
_prismium_skipped_files = []
try:
    for _prismium_filename, _prismium_state in _prismium_file_snapshot().items():
        _prismium_path = os.path.join(_prismium_working_directory, _prismium_filename)
        if _prismium_filename in _prismium_input_payloads:
            with open(_prismium_path, "rb") as _prismium_file:
                _prismium_current_payload = base64.b64encode(_prismium_file.read()).decode("ascii")
            if _prismium_current_payload == _prismium_input_payloads[_prismium_filename]:
                continue
        elif _prismium_before.get(_prismium_filename) == _prismium_state:
            continue
        if len(_prismium_artifacts) >= ${MAX_PYTHON_ARTIFACTS}:
            _prismium_skipped_files.append(_prismium_filename)
            continue
        if _prismium_state[0] > ${MAX_PYTHON_ARTIFACT_BYTES}:
            _prismium_skipped_files.append(_prismium_filename)
            continue
        with open(_prismium_path, "rb") as _prismium_file:
            _prismium_artifacts.append({
                "filename": _prismium_filename,
                "content": base64.b64encode(_prismium_file.read()).decode("ascii"),
                "contentEncoding": "base64",
            })
except BaseException:
    # A failed artifact capture must never hide normal Python stdout or errors.
    pass

_prismium_result["artifacts"] = _prismium_artifacts
_prismium_result["skippedFiles"] = _prismium_skipped_files
json.dumps(_prismium_result)
`);

    const parsed = JSON.parse(String(result)) as {
        stdout?: string;
        stderr?: string;
        error?: string | null;
        artifacts?: unknown;
        skippedFiles?: unknown;
    };
    const output = [
        parsed.stdout ? `stdout:\n${parsed.stdout.trim()}` : "",
        parsed.stderr ? `stderr:\n${parsed.stderr.trim()}` : "",
        parsed.error ? `Python error:\n${parsed.error.trim()}` : "",
    ]
        .filter(Boolean)
        .join("\n\n")
        .trim();

    const artifacts = Array.isArray(parsed.artifacts)
        ? parsed.artifacts
              .filter((artifact): artifact is Record<string, unknown> =>
                  Boolean(artifact && typeof artifact === "object"),
              )
              .map((artifact) => ({
                  filename: String(artifact.filename ?? "").replace(/[\\/]/g, "_").trim(),
                  content: String(artifact.content ?? ""),
                  contentEncoding: artifact.contentEncoding === "base64" ? "base64" as const : null,
              }))
              .filter(
                  (artifact): artifact is BrowserPythonArtifact =>
                      Boolean(artifact.filename) &&
                      artifact.contentEncoding === "base64" &&
                      artifact.content.length > 0,
              )
              .slice(0, MAX_PYTHON_ARTIFACTS)
        : [];
    const skippedFiles = Array.isArray(parsed.skippedFiles)
        ? parsed.skippedFiles.map((filename) => String(filename)).filter(Boolean).slice(0, MAX_PYTHON_ARTIFACTS)
        : [];
    const artifactSummary = artifacts.length
        ? `Created Canvas artifact${artifacts.length === 1 ? "" : "s"}: ${artifacts.map((artifact) => artifact.filename).join(", ")}. Images and other files are shown in Canvas and persisted with this chat when under the size limit. Prefer PNG/SVG from savefig for charts; do not recreate or Base64-copy them.`
        : "";
    const skippedSummary = skippedFiles.length
        ? `Not exported from Python (limit: ${MAX_PYTHON_ARTIFACT_BYTES / (1024 * 1024)} MiB each): ${skippedFiles.join(", ")}.`
        : "";

    return {
        output: [output || "Python completed with no output.", artifactSummary, skippedSummary]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 64_000),
        artifacts,
    };
}
