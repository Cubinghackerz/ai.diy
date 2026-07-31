/**
 * Root Layout — HTML document shell with global providers
 */

import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { LinksFunction } from "react-router";
import { SettingsProvider } from "~/lib/providers/SettingsProvider";
import { TooltipProvider } from "~/components/ui/tooltip";
import "~/styles/app.css";

export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap",
    },
    { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
];

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
                />
                <meta
                    name="description"
                    content="ai.diy — Open-source local-first AI chat with BYOK, web search, tools, and MCP support"
                />
                <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
                <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
                <Meta />
                <Links />
            </head>
            <body className="font-sans antialiased">
                <SettingsProvider>
                    <TooltipProvider delay={200}>{children}</TooltipProvider>
                </SettingsProvider>
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
            <Outlet />
        </div>
    );
}
