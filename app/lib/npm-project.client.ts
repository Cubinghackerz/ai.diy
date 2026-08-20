import type { LinuxClientResult } from "~/lib/cheerpx";
import type { NpmProjectInput } from "~/lib/npm-project";
import { executeWebContainerNpmProjectTool } from "~/lib/webcontainer-npm-project.client";

function describeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

/** Execute npm projects in the browser-native WebContainer Node runtime. */
export async function executeNpmProjectClientTool(
    input: NpmProjectInput,
    scopeId: string,
): Promise<LinuxClientResult> {
    try {
        return await executeWebContainerNpmProjectTool(input, scopeId);
    } catch (error) {
        return {
            output: `npm_project WebContainer error: ${describeError(error)}`,
            artifacts: [],
        };
    }
}
