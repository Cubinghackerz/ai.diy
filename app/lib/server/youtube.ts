import { assertPublicHttpUrl } from "~/lib/server/ssrf";

const MAX_TRANSCRIPT_CHARS = 24_000;

export function extractYoutubeVideoId(raw: string): string | null {
    const value = raw.trim();
    if (!value) return null;
    if (/^[\w-]{11}$/.test(value)) return value;
    try {
        const url = new URL(value.startsWith("http") ? value : `https://${value}`);
        const host = url.hostname.replace(/^www\./, "");
        if (host === "youtu.be") {
            const id = url.pathname.split("/").filter(Boolean)[0];
            return id && /^[\w-]{11}$/.test(id) ? id : null;
        }
        if (
            host === "youtube.com" ||
            host === "m.youtube.com" ||
            host === "music.youtube.com" ||
            host.endsWith(".youtube.com")
        ) {
            const fromQuery = url.searchParams.get("v");
            if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) return fromQuery;
            const parts = url.pathname.split("/").filter(Boolean);
            if (
                parts[0] &&
                ["embed", "shorts", "live", "v"].includes(parts[0]) &&
                parts[1] &&
                /^[\w-]{11}$/.test(parts[1])
            ) {
                return parts[1];
            }
        }
    } catch {
        return null;
    }
    return null;
}

function decodeEntities(value: string): string {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, code) =>
            String.fromCharCode(Number(code)),
        );
}

function parseCaptionXml(xml: string): string {
    const texts = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map(
        (match) =>
            decodeEntities(match[1].replace(/<[^>]+>/g, " ")).replace(
                /\s+/g,
                " ",
            ).trim(),
    );
    return texts.filter(Boolean).join(" ");
}

type CaptionTrack = {
    baseUrl?: string;
    languageCode?: string;
    kind?: string;
};

function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
    if (!tracks.length) return null;
    const scored = tracks
        .filter((track) => track.baseUrl)
        .sort((left, right) => {
            const rank = (track: CaptionTrack) => {
                const lang = (track.languageCode ?? "").toLowerCase();
                if (lang === "en" || lang.startsWith("en-")) return 0;
                if (track.kind === "asr") return 2;
                return 1;
            };
            return rank(left) - rank(right);
        });
    return scored[0] ?? null;
}

export async function fetchYoutubeTranscript(rawUrl: string): Promise<string> {
    const videoId = extractYoutubeVideoId(rawUrl);
    if (!videoId) {
        return "That does not look like a YouTube video URL or id.";
    }
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    assertPublicHttpUrl(watchUrl);
    const page = await fetch(watchUrl, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (compatible; ai.diy/0.1; +https://github.com/Cubinghackerz/ai.diy)",
            "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(12_000),
    });
    if (!page.ok) return `Could not open the YouTube page (HTTP ${page.status}).`;
    const html = await page.text();
    const playerMatch = html.match(
        /ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});\s*(?:var|<\/script>)/,
    );
    if (!playerMatch?.[1]) {
        return "Could not read this YouTube player payload. The video may be private, age-restricted, or blocked.";
    }
    let player: {
        videoDetails?: {
            title?: string;
            author?: string;
            lengthSeconds?: string;
            shortDescription?: string;
        };
        captions?: {
            playerCaptionsTracklistRenderer?: {
                captionTracks?: CaptionTrack[];
            };
        };
        playabilityStatus?: { status?: string; reason?: string };
    };
    try {
        player = JSON.parse(playerMatch[1]) as typeof player;
    } catch {
        return "Could not parse YouTube player data for this video.";
    }
    const status = player.playabilityStatus?.status;
    if (status && status !== "OK") {
        return `YouTube would not play this video (${status}${player.playabilityStatus?.reason ? `: ${player.playabilityStatus.reason}` : ""}).`;
    }
    const details = player.videoDetails;
    const tracks =
        player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const track = pickCaptionTrack(tracks);
    let transcript = "";
    if (track?.baseUrl) {
        assertPublicHttpUrl(track.baseUrl);
        const captions = await fetch(track.baseUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (compatible; ai.diy/0.1; +https://github.com/Cubinghackerz/ai.diy)",
            },
            signal: AbortSignal.timeout(12_000),
        });
        if (captions.ok) {
            transcript = parseCaptionXml(await captions.text());
        }
    }
    const lines = [
        `Title: ${details?.title || "Unknown"}`,
        details?.author ? `Channel: ${details.author}` : "",
        details?.lengthSeconds
            ? `Duration: ${Math.max(1, Math.round(Number(details.lengthSeconds) / 60))} min`
            : "",
        `URL: ${watchUrl}`,
        "",
        transcript
            ? `Transcript:\n${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}`
            : details?.shortDescription
              ? `No captions were available. Description:\n${details.shortDescription.slice(0, 4_000)}`
              : "No captions or description were available for this video.",
    ].filter(Boolean);
    return lines.join("\n");
}
