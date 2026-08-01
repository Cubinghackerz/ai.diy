/**
 * Server runtime flags for the standalone Node deployment.
 *
 * API keys remain BYOK and are never read from environment variables. These
 * helpers only control optional local capabilities available to the Node host.
 */

export function isPythonDisabled(): boolean {
    return process.env.DISABLE_PYTHON === "1";
}

let pythonAvailable: boolean | null = null;

/** Python subprocess tool — available when python3 exists on the host. */
export async function isPythonRuntimeAvailable(): Promise<boolean> {
    if (isPythonDisabled()) return false;
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
