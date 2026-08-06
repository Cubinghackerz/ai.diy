import type { Config } from "@react-router/dev/config";

export default {
    ssr: process.env.VERCEL !== "1",
    prerender: ["/", "/workspace"],
} satisfies Config;
