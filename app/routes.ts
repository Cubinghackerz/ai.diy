/**
 * React Router Route Configuration
 * 
 * Defines the file-based routes for the application.
 */

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/landing.tsx"),
    route("workspace", "routes/home.tsx"),
] satisfies RouteConfig;
