export const BUILD_ID = __BUILD_ID__;

export function versionedAsset(path: string): string {
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}v=${encodeURIComponent(BUILD_ID)}`;
}
