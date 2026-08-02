type CompatibleFetch = (
    input: RequestInfo | URL,
    init?: RequestInit,
) => Promise<Response>;

export function createCompatibleFetch(
    timeoutMs = 60_000,
    maxRetries = 2,
    options: { stripAuthorization?: boolean } = {},
): CompatibleFetch {
    const timeout = Math.min(300_000, Math.max(5_000, timeoutMs));
    const retries = Math.min(5, Math.max(0, maxRetries));

    return async (input, init) => {
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
            const abortCaller = () => controller.abort();
            init?.signal?.addEventListener("abort", abortCaller, { once: true });
            try {
                const headers = new Headers(init?.headers);
                if (options.stripAuthorization) headers.delete("Authorization");
                const response = await fetch(input, {
                    ...init,
                    headers,
                    signal: controller.signal,
                });
                if (
                    attempt < retries &&
                    (response.status === 408 || response.status === 429 || response.status >= 500)
                ) {
                    await delay(250 * 2 ** attempt);
                    continue;
                }
                return response;
            } catch (error) {
                if (attempt >= retries || init?.signal?.aborted) throw error;
                await delay(250 * 2 ** attempt);
            } finally {
                clearTimeout(timer);
                init?.signal?.removeEventListener("abort", abortCaller);
            }
        }
        throw new Error("Compatible provider request failed.");
    };
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
