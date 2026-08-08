/**
 * Root Layout — HTML document shell with global providers
 */

import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { LinksFunction, MetaFunction } from "react-router";
import { SettingsProvider } from "~/lib/providers/SettingsProvider";
import { TooltipProvider } from "~/components/ui/tooltip";
import "~/styles/app.css";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('prismium-lite:settings');var theme=t?JSON.parse(t).theme:'system';if(theme==='dark'||(theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`;

export const meta: MetaFunction = () => [
    { name: "color-scheme", content: "dark light" },
];

export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,400..900;1,62..125,400..900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap",
    },
    { rel: "icon", type: "image/png", href: "/ai-diy.png" },
    { rel: "apple-touch-icon", href: "/ai-diy.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html className="h-full" suppressHydrationWarning>
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
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
        <div className="flex h-screen w-screen overflow-x-hidden overflow-y-auto bg-background text-foreground">
            <Outlet />
        </div>
    );
}
