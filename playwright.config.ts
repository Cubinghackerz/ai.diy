import { defineConfig } from "@playwright/test";

const dev = process.env.E2E_DEV === "true";
const baseURL = dev ? "http://localhost:5173" : "http://localhost:3000";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 45_000,
    use: { baseURL, browserName: "chromium", trace: "retain-on-failure" },
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
    webServer: [
        {
            command: "node scripts/mock-provider.mjs",
            url: "http://127.0.0.1:18765/health",
            reuseExistingServer: false,
        },
        {
            command: dev
                ? "npm run dev -- --host localhost --port 5173 --strictPort --force"
                : "npm start",
            url: `${baseURL}/workspace`,
            reuseExistingServer: false,
            timeout: 120_000,
            env: { ALLOW_PRIVATE_PROVIDER_URLS: "true", PORT: "3000", HOST: "localhost" },
        },
    ],
});
