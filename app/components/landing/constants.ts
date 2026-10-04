import type { ProviderId } from "~/lib/types";

export const GITHUB_REPO = "Cubinghackerz/ai.diy";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const CHANGELOG_URL = `${GITHUB_URL}/commits/main`;
export const DOCS_URL = `${GITHUB_URL}#readme`;
export const TWITTER_URL = "https://x.com/HeckingHacker";
export const SUPPORT_EMAIL = "support@tryaidiy.com";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const VERCEL_DEPLOY_URL =
    "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCubinghackerz%2Fai.diy&project-name=ai-diy-preview";

/**
 * Every ProviderId in app/lib/types.ts. README lists the same 26 integrations.
 * Adding a provider to the union without listing it here fails typecheck.
 */
export const PROVIDER_INTEGRATIONS = [
    "openai",
    "chatgpt",
    "grok",
    "kimi",
    "glm",
    "minimax",
    "anthropic",
    "gemini",
    "groq",
    "cerebras",
    "fireworks",
    "perplexity",
    "cohere",
    "openrouter",
    "deepseek",
    "bedrock",
    "azure",
    "vertex",
    "gateway",
    "togetherai",
    "mistral",
    "huggingface",
    "lmstudio",
    "xai",
    "ollama",
    "custom",
] as const satisfies readonly ProviderId[];

type MissingProvider = Exclude<ProviderId, (typeof PROVIDER_INTEGRATIONS)[number]>;
export const providerIntegrationsComplete: MissingProvider extends never ? true : never = true;

export const PROVIDER_INTEGRATION_COUNT = PROVIDER_INTEGRATIONS.length;

/** README provider list, kept in the same order as the status section. */
export const PROVIDER_INTEGRATION_SUMMARY = `${PROVIDER_INTEGRATION_COUNT} integrations: OpenAI, ChatGPT subscription, Grok subscription, Kimi subscription, GLM, MiniMax, Anthropic, Gemini, Groq, Cerebras, Fireworks, Perplexity, Cohere, OpenRouter, xAI, DeepSeek, Bedrock, Azure, Vertex, Vercel Gateway, Together, Mistral, Hugging Face, Ollama, LM Studio, and custom OpenAI-compatible endpoints.`;

export const LANDING_JUMPS = [
    { href: "#demo", label: "Demo" },
    { href: "#features", label: "Ownership" },
    { href: "#providers", label: "Providers" },
    { href: "#apps", label: "Apps" },
    { href: "#in-use", label: "In use" },
    { href: "#capabilities", label: "Capabilities" },
    { href: "#deploy", label: "Deploy" },
    { href: "#faq", label: "FAQ" },
    { href: "#changelog", label: "Changelog" },
] as const;

/** Featured provider marks for landing shelves (no infinite marquee). */
export const PROVIDER_LOGOS: Array<{ src: string; label: string; id: string }> = [
    { id: "openai", src: "/landing-logos/openai-mark.png", label: "OpenAI" },
    { id: "grok", src: "/landing-logos/xai-lobe.png", label: "Grok" },
    { id: "gemini", src: "/landing-logos/gemini.png", label: "Gemini" },
    { id: "claude", src: "/landing-logos/anthropic-lobe.png", label: "Claude" },
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
