import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
    define: { __BUILD_ID__: JSON.stringify("test") },
    resolve: { alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) } },
    test: {
        environment: "jsdom",
        include: ["tests/unit/**/*.test.{ts,tsx}"],
        setupFiles: ["./tests/unit/setup.ts"],
        restoreMocks: true,
    },
});
