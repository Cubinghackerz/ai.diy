let pyodidePromise: Promise<PyodideRuntime> | null = null;

type PyodideRuntime = {
    loadPackagesFromImports?: (code: string) => Promise<void>;
    loadPackage?: (packages: string | string[]) => Promise<void>;
    runPythonAsync: (code: string) => Promise<unknown>;
};

type PyodideWindow = Window & {
    loadPyodide?: (options: { indexURL: string }) => Promise<PyodideRuntime>;
};

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// Pyodide loads these only when the user's code imports the matching module.
// Keeping the map here makes common scientific, data, plotting, parsing, and
// image workflows work without requiring a local Python installation.
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
};

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
            if ((window as PyodideWindow).loadPyodide) finish();
            else existing.addEventListener("load", finish, { once: true });
            return;
        }

        const script = document.createElement("script");
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

export async function runBrowserPython(code: string): Promise<string> {
    const source = String(code ?? "").trim();
    if (!source) return "Python error: no code provided.";

    const pyodide = await loadPyodide();
    try {
        await pyodide.loadPackagesFromImports?.(source);
    } catch {
        // Alias loading below handles common import names such as sklearn and
        // PIL. Unknown imports are reported by Python with a useful traceback.
    }
    const importedModules = [...source.matchAll(/^\s*(?:from|import)\s+([A-Za-z0-9_]+)/gm)]
        .map((match) => match[1])
        .filter((module): module is string => Boolean(module));
    const usefulPackages = [
        ...new Set(
            importedModules
                .map((module) => USEFUL_PACKAGE_ALIASES[module])
                .filter((packageName): packageName is string => Boolean(packageName)),
        ),
    ];
    for (const packageName of usefulPackages) {
        try {
            await pyodide.loadPackage?.(packageName);
        } catch {
            // Let Python return the import traceback if this optional package
            // is unavailable in the selected Pyodide release.
        }
    }

    const result = await pyodide.runPythonAsync(`
import contextlib
import io
import json
import traceback

_prismium_stdout = io.StringIO()
_prismium_stderr = io.StringIO()
try:
    with contextlib.redirect_stdout(_prismium_stdout), contextlib.redirect_stderr(_prismium_stderr):
        exec(${JSON.stringify(source)}, globals())
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
json.dumps(_prismium_result)
`);

    const parsed = JSON.parse(String(result)) as {
        stdout?: string;
        stderr?: string;
        error?: string | null;
    };
    const output = [
        parsed.stdout ? `stdout:\n${parsed.stdout.trim()}` : "",
        parsed.stderr ? `stderr:\n${parsed.stderr.trim()}` : "",
        parsed.error ? `Python error:\n${parsed.error.trim()}` : "",
    ]
        .filter(Boolean)
        .join("\n\n")
        .trim();

    return (output || "Python completed with no output.").slice(0, 64_000);
}
