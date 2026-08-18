export const GITHUB_REPO = "Cubinghackerz/ai.diy";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const DOCS_URL = `${GITHUB_URL}#readme`;
export const TWITTER_URL = "https://x.com/HeckingHacker";
export const VERCEL_DEPLOY_URL =
    "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCubinghackerz%2Fai.diy&project-name=ai-diy-preview";

/** Featured provider marks for landing shelves (no infinite marquee). */
export const PROVIDER_LOGOS: Array<{ src: string; label: string; id: string }> = [
    { id: "openai", src: "/landing-logos/openai-mark.png", label: "OpenAI" },
    { id: "grok", src: "/landing-logos/anthropic-mark.png", label: "Grok" },
    { id: "gemini", src: "/landing-logos/gemini.png", label: "Gemini" },
    { id: "claude", src: "/landing-logos/groq.png", label: "Claude" },
    { id: "openrouter", src: "/landing-logos/openrouter-lobe.png", label: "OpenRouter" },
    { id: "deepseek", src: "/landing-logos/deepseek-lobe.png", label: "DeepSeek" },
    { id: "ollama", src: "/landing-logos/ollama-lobe.png", label: "Ollama" },
];

/** Top four newest Downloads marks — used on ownership constellation nodes. */
export const FEATURED_PROVIDER_MARKS = PROVIDER_LOGOS.slice(0, 4);

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
