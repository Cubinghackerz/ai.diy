/**
 * React Router Route Configuration
 * 
 * Defines the file-based routes for the application.
 */

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("api/chat", "routes/api.chat.ts"),
    route("api/models", "routes/api.models.ts"),
    route("api/search", "routes/api.search.ts"),
    route("api/connectors", "routes/api.connectors.ts"),
    route("api/capabilities", "routes/api.capabilities.ts"),
    route("api/title", "routes/api.title.ts"),
] satisfies RouteConfig;
