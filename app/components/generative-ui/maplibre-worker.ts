// MapLibre 6 ships its worker as a separate file that the bundled entry cannot
// locate on its own, so we supply the URL. The workspace is cross-origin
// isolated (COEP: credentialless, required by the Linux VM), and a worker
// script fetched from a static asset URL is blocked unless that response
// carries COEP too, while Vite's dev server also rewrites fetched modules. A
// same-origin Blob URL built from the raw source avoids both. The source is a
// lazy chunk that only loads when the first map is shown.

let blobUrl: Promise<string> | null = null;

export function loadMapWorkerUrl(): Promise<string> {
    blobUrl ??= import("maplibre-gl/dist/maplibre-gl-worker.mjs?raw")
        .then(({ default: code }) =>
            URL.createObjectURL(new Blob([code], { type: "text/javascript" })),
        )
        .catch((error: unknown) => {
            blobUrl = null;
            throw error;
        });
    return blobUrl;
}
