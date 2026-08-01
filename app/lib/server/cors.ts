const ALLOW_METHODS = "POST, OPTIONS";
const ALLOW_HEADERS = "Content-Type, Authorization, X-Requested-With";

function configuredOrigins(): string[] {
    return (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => Boolean(origin) && origin !== "*");
}

function allowedOrigin(request: Request): string | null {
    const origin = request.headers.get("Origin");
    if (!origin) return null;

    const configured = configuredOrigins();
    return configured.includes(origin) ? origin : null;
}

/** Add CORS headers only for origins explicitly allowed by CORS_ORIGINS. */
export function withCors(request: Request, response: Response): Response {
    const origin = allowedOrigin(request);
    if (!origin) return response;

    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", ALLOW_METHODS);
    headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
    headers.set("Access-Control-Max-Age", "86400");
    const vary = headers.get("Vary");
    headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

/** Handle browser preflight requests before a route parses a request body. */
export function corsPreflight(request: Request): Response | null {
    if (request.method !== "OPTIONS") return null;

    const requestOrigin = request.headers.get("Origin");
    if (requestOrigin && !allowedOrigin(request)) {
        return Response.json(
            { error: "CORS origin is not allowed." },
            { status: 403 },
        );
    }

    const response = new Response(null, {
        status: 204,
        headers: {
            Allow: ALLOW_METHODS,
            "Access-Control-Allow-Methods": ALLOW_METHODS,
            "Access-Control-Allow-Headers": ALLOW_HEADERS,
            "Access-Control-Max-Age": "86400",
        },
    });
    return withCors(request, response);
}
