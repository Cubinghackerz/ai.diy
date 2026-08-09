export const GITHUB_REPO = "Cubinghackerz/ai.diy";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const DOCS_URL = `${GITHUB_URL}#readme`;

export const PROVIDER_LOGOS: Array<{ src: string; label: string; id: string }> = [
    { id: "openai", src: "/landing-logos/openai.png", label: "OpenAI" },
    { id: "anthropic", src: "/landing-logos/anthropic.png", label: "Anthropic" },
    { id: "google", src: "/landing-logos/google.png", label: "Google Gemini" },
    { id: "openrouter", src: "/landing-logos/openrouter.png", label: "OpenRouter" },
    { id: "deepseek", src: "/landing-logos/deepseek.png", label: "DeepSeek" },
    { id: "firecrawl", src: "/landing-logos/firecrawl.png", label: "Firecrawl" },
    { id: "parallel", src: "/landing-logos/parallel.png", label: "Parallel" },
];

export const DEPLOY_TABS = [
    {
        id: "npm" as const,
        label: "npm",
        command: "npm install\nnpm run build && npm start",
    },
    {
        id: "docker" as const,
        label: "Docker",
        command: "docker compose up --build",
    },
    {
        id: "vercel" as const,
        label: "Vercel",
        command: "npx vercel",
    },
];

export type DeployTabId = (typeof DEPLOY_TABS)[number]["id"];
