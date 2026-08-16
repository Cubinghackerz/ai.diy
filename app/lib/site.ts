const DEFAULT_SITE_URL = "https://ai-diy-demo.vercel.app";
const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();

export const SITE_URL = (configuredSiteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
export const SITE_NAME = "ai.diy";
export const SITE_TITLE = "ai.diy | Open-Source, Self-Hosted AI Workspace";
export const SITE_DESCRIPTION =
    "ai.diy is an open-source, self-hosted AI workspace for BYOK chat. Keep keys, chats, memory, and knowledge in your browser while using 17 cloud or local providers.";
export const SITE_IMAGE_URL = `${SITE_URL}/og-image.png`;
export const SITE_IMAGE_ALT = "ai.diy open-source self-hosted AI workspace";
export const SITE_TWITTER_HANDLE = "@HeckingHacker";
export const SITE_KEYWORDS =
    "open source AI workspace, self-hosted AI chat, BYOK AI, local-first AI, private AI workspace, Ollama chat, browser-based AI";
export const SITE_LAST_MODIFIED = "2026-08-16";
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
