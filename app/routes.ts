/**
 * React Router Route Configuration
 * 
 * Defines the file-based routes for the application.
 */

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/landing.tsx"),
    route("self-hosted-ai", "routes/seo/self-hosted-ai.tsx"),
    route("local-ai", "routes/seo/local-ai.tsx"),
    route("mcp", "routes/seo/mcp.tsx"),
    route("agents", "routes/seo/agents.tsx"),
    route("multi-model", "routes/seo/multi-model.tsx"),
    route("sitemap.xml", "routes/sitemap[.]xml.ts"),
    route("robots.txt", "routes/robots[.]txt.ts"),
    route("workspace", "routes/home.tsx"),
    route("api/chat", "routes/api.chat.ts"),
    route("api/chatgpt/*", "routes/api.chatgpt.$.ts"),
    route("api/grok/*", "routes/api.grok.$.ts"),
    route("callback", "routes/grok.callback.ts"),
    route("api/models", "routes/api.models.ts"),
    route("api/search", "routes/api.search.ts"),
    route("api/connectors", "routes/api.connectors.ts"),
    route("api/connect", "routes/api.connect.ts"),
    route("api/title", "routes/api.title.ts"),
    route("privacy", "routes/privacy.tsx"),
    route("terms", "routes/terms.tsx"),
    route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
