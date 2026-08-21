import type { Config } from "@react-router/dev/config";

export default {
    ssr: true,
    prerender: [
        "/",
        "/privacy",
        "/terms",
        "/agents",
        "/local-ai",
        "/mcp",
        "/multi-model",
        "/self-hosted-ai",
    ],
} satisfies Config;
