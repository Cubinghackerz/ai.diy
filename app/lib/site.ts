const DEFAULT_SITE_URL = "https://tryaidiy.com";
const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();

export const SITE_URL = (configuredSiteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
export const SITE_NAME = "ai.diy";
export const SITE_TITLE = "ai.diy | Browser-Owned AI Workspace — Chat, Apps, Self-Host";
export const SITE_DESCRIPTION =
    "ai.diy is the open-source, browser-owned AI workspace. Bring your own keys, chat with 20+ cloud and local models, connect Gmail, GitHub, Notion and Slack via Composio, and keep chats, files, and settings on your device.";
export const SITE_IMAGE_URL = `${SITE_URL}/og-image.png`;
export const SITE_IMAGE_ALT = "ai.diy browser-owned AI workspace with a self-hosted relay";
export const SITE_TWITTER_HANDLE = "@HeckingHacker";
export const SITE_KEYWORDS =
    "ai.diy, tryaidiy, open source AI workspace, self-hosted AI chat, BYOK AI, local-first AI, private AI workspace, Ollama chat, LM Studio, browser-based AI, connect Gmail to AI, GitHub AI assistant, Notion AI, Slack AI, Composio MCP, self-hosted ChatGPT alternative, MCP client, multi-model AI, local AI workspace";
export const SITE_LAST_MODIFIED = "2026-08-23";
export const SITE_LOGO_URL = `${SITE_URL}/ai-diy-new-logo.png`;
export const SITE_REPOSITORY_URL = "https://github.com/Cubinghackerz/ai.diy";
export const SITE_SOCIAL_URLS = [
    SITE_REPOSITORY_URL,
    "https://x.com/HeckingHacker",
] as const;
export const GOOGLE_SITE_VERIFICATION =
    "DxCjy8rLi-HJ6YDrVoN9UWiBR0cBDZlY0F2rDtEKyII";

/** Keep public pages indexable while giving crawlers the full result surface. */
export const PUBLIC_ROBOTS_DIRECTIVE =
    "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
