/**
 * Root Layout — HTML document shell with global providers
 */

import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useRouteError,
} from "react-router";
import type { HeadersFunction, LinksFunction, MetaFunction } from "react-router";
import { SettingsProvider } from "~/lib/providers/SettingsProvider";
import { TooltipProvider } from "~/components/ui/tooltip";
import { LaunchFallback } from "~/components/launch/LaunchFallback";
import { BUILD_ID } from "~/lib/build";
import { pageMeta } from "~/lib/seo";
import { SITE_TITLE, SITE_URL } from "~/lib/site";
import "~/styles/app.css";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('prismium-lite:theme');var theme=t||(localStorage.getItem('prismium-lite:settings')?(JSON.parse(localStorage.getItem('prismium-lite:settings')).theme||'system'):'system');var dark=theme==='dark'||theme==='oled'||(theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.classList.toggle('oled',theme==='oled')}catch(e){}})();`;

// App routes stay no-store. /workspace restores COOP/COEP (see home.tsx) for CheerpX.
const HEADERS: Record<string, string> = {
    "Cache-Control": "no-store, max-age=0",
    "X-AI-DIY-Build": BUILD_ID,
};
export const headers: HeadersFunction = () => HEADERS;

export const meta: MetaFunction = () =>
    pageMeta({ title: SITE_TITLE, url: `${SITE_URL}/` });

export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Hanken+Grotesk:wght@400;500;600;700&family=Fragment+Mono:wght@400;500&display=swap",
    },
    { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
    { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
    { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
    { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    { rel: "manifest", href: "/site.webmanifest" },
];

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="h-full" suppressHydrationWarning>
            <head>
                <meta charSet="utf-8" />
                <meta name="ai-diy-build" content={BUILD_ID} />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, viewport-fit=cover"
                />
                <meta
                    name="theme-color"
                    content="#000000"
                    media="(prefers-color-scheme: dark)"
                />
                <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
                <Meta />
                <Links />
            </head>
            <body className="font-sans antialiased">
                <div
                    hidden
                    dangerouslySetInnerHTML={{
                        __html: `<!-- ai.diy landing · direction contract
THESIS: The product is the proof — a black, flat, Vercel-grade workspace in the first viewport; rejects the text-left/media-right SaaS hero.
OWN-WORLD: #000 canvas, #0a0a0a surfaces, white/10 hairlines, flat mint signal, Geist Sans/Mono, zero gradients; depth from borders and soft shadows.
STORY: See the browser-owned workspace at full size, then open it or self-host it.
FIRST VIEWPORT: Centered cipher headline and actions above a full-width product window with the real workspace screenshot.
FORM: User-pinned canon (Vercel/Resend fidelity), built as responsive product proof.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. -->`,
                    }}
                />
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

export function ErrorBoundary() {
    const error = useRouteError();
    const status = isRouteErrorResponse(error) ? error.status : 500;

    return (
        <LaunchFallback
            eyebrow={`SYSTEM / ${status}`}
            title={status === 404 ? "That route does not exist." : "The workspace hit an error."}
            description={
                status === 404
                    ? "The page may have moved, or the link may be out of date."
                    : "Something interrupted this page. Return home or open the workspace and try again."
            }
        />
    );
}
