import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vite";

const buildId =
    process.env.VITE_BUILD_ID?.trim() ||
    `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

export default defineConfig({
    define: {
        __BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
        reactRouter(),
        tailwindcss(),
        tsconfigPaths(),
    ],
});
