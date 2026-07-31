/**
 * Server runtime flags — BYOK deploys should not require paid APIs.
 * Keep this file free of top-level node: imports so accidental client
 * imports don't crash the browser bundle.
 */

export function isVercelServerless(): boolean {
    return process.env.VERCEL === "1";
}

export function isPythonDisabled(): boolean {
    return process.env.DISABLE_PYTHON === "1";
}

let pythonAvailable: boolean | null = null;

/** Python subprocess tool — available on self-host/Docker with python3, not on Vercel. */
export async function isPythonRuntimeAvailable(): Promise<boolean> {
    if (isVercelServerless() || isPythonDisabled()) return false;
    if (pythonAvailable !== null) return pythonAvailable;
    try {
        const { execSync } = await import("node:child_process");
        execSync("python3 --version", { stdio: "ignore" });
        pythonAvailable = true;
    } catch {
        pythonAvailable = false;
    }
    return pythonAvailable;
}

export function isLocalhostUrl(url?: string): boolean {
    if (!url) return true;
    try {
        const host = new URL(url).hostname.toLowerCase();
        return (
            host === "localhost" ||
            host === "127.0.0.1" ||
            host === "::1" ||
            host.endsWith(".local")
        );
    } catch {
        return false;
    }
}

/** Block serverless hosts from calling the user's machine via default Ollama URL. */
export function validateProviderEndpoint(
    provider: string,
    baseUrl?: string,
): string | null {
    if (!isVercelServerless()) return null;
    if (provider !== "ollama" && provider !== "custom") return null;
    if (isLocalhostUrl(baseUrl)) {
        return "Local Ollama/custom endpoints only work when you self-host ai.diy (or expose your API at a public URL). On vercel.app, use a cloud provider with your own API key.";
    }
    return null;
}
