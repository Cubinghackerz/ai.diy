import { BUILD_ID } from "~/lib/build";

/** Workspace document: SharedArrayBuffer / CheerpX. Leaf headers replace root. */
export const WORKSPACE_DOCUMENT_HEADERS: Record<string, string> = {
    "Cache-Control": "no-store, max-age=0",
    "X-AI-DIY-Build": BUILD_ID,
    "Cross-Origin-Opener-Policy": "same-origin",
    // credentialless keeps CDN scripts/fonts working without CORP on every asset.
    "Cross-Origin-Embedder-Policy": "credentialless",
};

/** Public marketing / legal HTML. Root app routes stay no-store. */
export const PUBLIC_DOCUMENT_HEADERS: Record<string, string> = {
    "Cache-Control":
        "public, s-maxage=300, s-stale-while-revalidate=86400, max-age=0",
    "X-AI-DIY-Build": BUILD_ID,
};
