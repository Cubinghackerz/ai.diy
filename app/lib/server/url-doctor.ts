/**
 * URL Doctor — measured public-page audit (headers, HTML, bounded extra fetches).
 * Does not invent Lighthouse, Safe Browsing, or scheduled-monitor results.
 */

import { assertPublicHttpUrl } from "~/lib/server/ssrf";

export type UrlDoctorCategory =
    | "security"
    | "performance"
    | "seo"
    | "accessibility"
    | "privacy"
    | "links"
    | "conversion"
    | "reputation";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FixDifficulty = "easy" | "medium" | "hard";

export type UrlDoctorFinding = {
    category: UrlDoctorCategory;
    severity: FindingSeverity;
    title: string;
    detail: string;
    fix: string;
    difficulty: FixDifficulty;
};

export type UrlDoctorScore = {
    category: UrlDoctorCategory;
    label: string;
    score: number;
    notes: string[];
};

export type CheckStatus = "pass" | "fail" | "warn" | "info" | "skip";

export type UrlDoctorCheck = {
    id: string;
    label: string;
    status: CheckStatus;
    result: string;
};

export type UrlDoctorReport = {
    url: string;
    finalUrl: string;
    fetchedAt: string;
    status: number;
    contentType: string | null;
    bytes: number;
    ttfbMs: number;
    overall: number;
    scores: UrlDoctorScore[];
    findings: UrlDoctorFinding[];
    checks: UrlDoctorCheck[];
    limits: string[];
};

const UA = "Mozilla/5.0 (compatible; ai.diy-url-doctor/0.1)";
const TRACKER_HOST_RE =
    /\b(google-analytics|googletagmanager|doubleclick|facebook\.net|connect\.facebook|hotjar|segment\.io|mixpanel|amplitude|fullstory|clarity\.ms|adservice|adsystem|twitter\.com\/i\/adsct|linkedin\.com\/px|tiktok\.com\/i18n\/pixel|cdn\.mouseflow|newrelic|sentry\.io|hubspot|marketo|pardot)\b/i;
const CTA_RE =
    /\b(buy|shop|order|subscribe|sign\s*up|get\s*started|start\s*free|book|contact|demo|trial|add\s*to\s*cart|checkout)\b/i;
const SUSPICIOUS_TLD_RE = /\.(xyz|top|gq|tk|ml|cf|ga|click|zip|mov)(\.|$)/i;
const WP_RE = /wp-content|wp-includes|wp-json|wordpress/i;

function clamp(n: number, min = 0, max = 100): number {
    return Math.max(min, Math.min(max, Math.round(n)));
}

function attr(tag: string, name: string): string | null {
    const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");
    return tag.match(re)?.[1]?.trim() ?? null;
}

function metaContent(html: string, nameOrProp: string): string | null {
    const re = new RegExp(
        `<meta[^>]+(?:name|property)\\s*=\\s*["']${nameOrProp}["'][^>]*>`,
        "i",
    );
    const tag = html.match(re)?.[0];
    return tag ? attr(tag, "content") : null;
}

function countMatches(html: string, re: RegExp): number {
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    return [...html.matchAll(new RegExp(re.source, flags))].length;
}

function extractTitle(html: string): string | null {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function hdr(headers: Headers, name: string): string | null {
    return headers.get(name);
}

function scoreFromDeductions(base: number, deductions: number[]): number {
    return clamp(base - deductions.reduce((a, b) => a + b, 0));
}

function reputationLabel(score: number): string {
    if (score >= 80) return "Low Risk";
    if (score >= 55) return "Moderate Risk";
    return "Elevated Risk";
}

function priorityLabel(severity: FindingSeverity): string {
    if (severity === "critical") return "P1";
    if (severity === "high") return "P2";
    if (severity === "medium") return "P3";
    if (severity === "low") return "P4";
    return "P5";
}

function originOf(url: string): string {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
}

function hostOf(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return "";
    }
}

function check(
    id: string,
    label: string,
    status: CheckStatus,
    result: string,
): UrlDoctorCheck {
    return { id, label, status, result };
}

async function publicFetch(
    url: string,
    init: RequestInit & { timeoutMs?: number } = {},
): Promise<{
    url: string;
    status: number;
    headers: Headers;
    body: string;
    bytes: number;
    ms: number;
}> {
    assertPublicHttpUrl(url);
    const timeoutMs = init.timeoutMs ?? 8_000;
    const started = Date.now();
    const res = await fetch(url, {
        redirect: init.redirect ?? "follow",
        method: init.method ?? "GET",
        headers: {
            "User-Agent": UA,
            Accept: "*/*",
            ...(init.headers as Record<string, string> | undefined),
        },
        signal: AbortSignal.timeout(timeoutMs),
    });
    const buf = init.method === "HEAD" ? new ArrayBuffer(0) : await res.arrayBuffer();
    return {
        url: res.url || url,
        status: res.status,
        headers: res.headers,
        body: new TextDecoder("utf-8", { fatal: false }).decode(buf),
        bytes: buf.byteLength,
        ms: Date.now() - started,
    };
}

async function followRedirects(
    startUrl: string,
    maxHops = 8,
): Promise<Array<{ url: string; status: number }>> {
    const chain: Array<{ url: string; status: number }> = [];
    let current = startUrl;
    for (let i = 0; i < maxHops; i++) {
        assertPublicHttpUrl(current);
        const res = await fetch(current, {
            redirect: "manual",
            method: "GET",
            headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
            signal: AbortSignal.timeout(8_000),
        });
        chain.push({ url: current, status: res.status });
        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get("location");
            if (!loc) break;
            current = new URL(loc, current).href;
            continue;
        }
        break;
    }
    return chain;
}

async function headOrGet(url: string): Promise<number | null> {
    try {
        const head = await publicFetch(url, { method: "HEAD", timeoutMs: 5_000 });
        if (head.status !== 405 && head.status !== 501) return head.status;
    } catch {
        // fall through
    }
    try {
        const get = await publicFetch(url, { timeoutMs: 5_000 });
        return get.status;
    } catch {
        return null;
    }
}

async function dnsTxt(name: string): Promise<string[]> {
    try {
        const res = await fetch(
            `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
            {
                headers: { Accept: "application/dns-json" },
                signal: AbortSignal.timeout(6_000),
            },
        );
        if (!res.ok) return [];
        const json = (await res.json()) as {
            Answer?: Array<{ data?: string }>;
        };
        return (json.Answer ?? [])
            .map((a) => String(a.data ?? "").replace(/^"|"$/g, "").replace(/" "/g, ""))
            .filter(Boolean);
    } catch {
        return [];
    }
}

async function rdapCreated(domain: string): Promise<string | null> {
    try {
        const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
            headers: { Accept: "application/rdap+json, application/json" },
            signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as {
            events?: Array<{ eventAction?: string; eventDate?: string }>;
        };
        const created = json.events?.find((e) =>
            /registration|registered/i.test(e.eventAction ?? ""),
        );
        return created?.eventDate ?? null;
    } catch {
        return null;
    }
}

function unique<T>(items: T[]): T[] {
    return [...new Set(items)];
}

export function formatUrlDoctorReport(report: UrlDoctorReport): string {
    const lines: string[] = [
        `# URL Doctor: ${report.finalUrl}`,
        "",
        `**Overall Health: ${report.overall}/100**`,
        "",
        `| Category | Score |`,
        `| --- | ---: |`,
    ];
    for (const s of report.scores) {
        if (s.category === "reputation") {
            lines.push(
                `| ${s.label} | ${s.score}/100 · ${reputationLabel(s.score)} |`,
            );
        } else {
            lines.push(`| ${s.label} | ${s.score}/100 |`);
        }
    }
    lines.push(
        "",
        "## Fetch",
        `- Requested: ${report.url}`,
        `- Final URL: ${report.finalUrl}`,
        `- HTTP ${report.status} · ${report.contentType ?? "unknown type"} · ${report.bytes.toLocaleString()} bytes · TTFB ${report.ttfbMs}ms`,
        `- Fetched: ${report.fetchedAt}`,
        "",
        "## Checks",
        `| Check | Status | Result |`,
        `| --- | --- | --- |`,
    );
    for (const c of report.checks) {
        lines.push(`| ${c.label} | ${c.status} | ${c.result.replace(/\|/g, "/")} |`);
    }
    lines.push("", "## Findings (priority · difficulty · fix)");
    if (report.findings.length === 0) {
        lines.push("- No material findings.");
    } else {
        for (const f of report.findings) {
            lines.push(
                `- **[${priorityLabel(f.severity)}/${f.severity}/${f.category}]** ${f.title} — ${f.detail}`,
                `  - Difficulty: ${f.difficulty}`,
                `  - Fix: ${f.fix}`,
            );
        }
    }
    lines.push("", "## Category notes");
    for (const s of report.scores) {
        lines.push(`### ${s.label} (${s.score}/100)`);
        for (const note of s.notes) lines.push(`- ${note}`);
        lines.push("");
    }
    lines.push(
        "## Re-scan / monitoring",
        "- Re-scan after fixes: run `/URL Doctor` on the same URL and compare Overall Health + P1–P3 findings.",
        "- Historical tracking / scheduled monitoring / change alerts are **not** built into this local chat tool (no background worker).",
        "",
        "## Limits of this audit",
    );
    for (const limit of report.limits) lines.push(`- ${limit}`);
    lines.push(
        "",
        "Present these scores honestly. Do not invent Lab metrics, Safe Browsing hits, or checks marked skip.",
    );
    return lines.join("\n");
}

function find(
    findings: UrlDoctorFinding[],
    item: UrlDoctorFinding,
): void {
    findings.push(item);
}

export async function runUrlDoctor(rawUrl: string): Promise<UrlDoctorReport> {
    assertPublicHttpUrl(rawUrl);
    const fetchedAt = new Date().toISOString();
    const findings: UrlDoctorFinding[] = [];
    const checks: UrlDoctorCheck[] = [];
    const secNotes: string[] = [];
    const secDeduct: number[] = [];
    const perfNotes: string[] = [];
    const perfDeduct: number[] = [];
    const seoNotes: string[] = [];
    const seoDeduct: number[] = [];
    const a11yNotes: string[] = [];
    const a11yDeduct: number[] = [];
    const privNotes: string[] = [];
    const privDeduct: number[] = [];
    const linkNotes: string[] = [];
    const linkDeduct: number[] = [];
    const convNotes: string[] = [];
    const convDeduct: number[] = [];
    const repNotes: string[] = [];
    const repDeduct: number[] = [];

    const started = Date.now();
    const res = await fetch(rawUrl, {
        redirect: "follow",
        headers: {
            "User-Agent": UA,
            Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(12_000),
    });
    const buf = await res.arrayBuffer();
    const ttfbMs = Date.now() - started;
    const bytes = buf.byteLength;
    const contentType = hdr(res.headers, "content-type");
    const finalUrl = res.url || rawUrl;
    const html =
        contentType && !/text\/html|application\/xhtml/i.test(contentType) && bytes > 0
            ? ""
            : new TextDecoder("utf-8", { fatal: false }).decode(buf);

    const origin = originOf(finalUrl);
    const finalHost = hostOf(finalUrl);
    const registrable = finalHost.replace(/^www\./i, "");
    const isHttps = finalUrl.startsWith("https:");

    const hsts = hdr(res.headers, "strict-transport-security");
    const csp = hdr(res.headers, "content-security-policy");
    const xfo = hdr(res.headers, "x-frame-options");
    const referrerPolicy = hdr(res.headers, "referrer-policy");
    const permissionsPolicy =
        hdr(res.headers, "permissions-policy") ?? hdr(res.headers, "feature-policy");
    const xcto = hdr(res.headers, "x-content-type-options");
    const encoding = hdr(res.headers, "content-encoding");
    const cacheControl = hdr(res.headers, "cache-control");
    const server = hdr(res.headers, "server");
    const powered = hdr(res.headers, "x-powered-by");
    const setCookie = hdr(res.headers, "set-cookie");

    const cdnHints = [
        hdr(res.headers, "cf-ray") && "Cloudflare",
        hdr(res.headers, "x-vercel-id") && "Vercel",
        hdr(res.headers, "x-amz-cf-id") && "CloudFront",
        hdr(res.headers, "x-served-by") && "Fastly/Varnish",
        hdr(res.headers, "x-fastly-request-id") && "Fastly",
        /cloudflare/i.test(server ?? "") && "Cloudflare",
        /nginx/i.test(server ?? "") && "nginx",
    ].filter((x): x is string => Boolean(x));

    let redirectChain: Array<{ url: string; status: number }> = [];
    try {
        redirectChain = await followRedirects(rawUrl);
    } catch {
        redirectChain = [{ url: rawUrl, status: res.status }];
    }
    checks.push(
        check(
            "redirect-chain",
            "Redirect chains",
            redirectChain.length > 3 ? "warn" : "pass",
            redirectChain.map((h) => `${h.status} ${h.url}`).join(" → ") || "none",
        ),
    );
    if (redirectChain.length > 3) {
        secDeduct.push(4);
        find(findings, {
            category: "performance",
            severity: "low",
            title: "Long redirect chain",
            detail: `${redirectChain.length} hops before the document.`,
            difficulty: "easy",
            fix: "Collapse redirects to a single hop to the canonical HTTPS URL.",
        });
    }

    let httpToHttps = "not tested";
    if (finalHost) {
        try {
            const httpUrl = `http://${finalHost}/`;
            const chain = await followRedirects(httpUrl, 6);
            const landedHttps = chain.some((h) => h.url.startsWith("https:")) ||
                chain[chain.length - 1]?.url.startsWith("https:");
            httpToHttps = landedHttps
                ? `yes (${chain.map((h) => h.status).join("→")})`
                : `no (${chain.map((h) => `${h.status} ${h.url}`).join(" → ")})`;
            checks.push(
                check(
                    "http-https",
                    "HTTP → HTTPS redirect",
                    landedHttps ? "pass" : "fail",
                    httpToHttps,
                ),
            );
            if (!landedHttps) {
                secDeduct.push(15);
                find(findings, {
                    category: "security",
                    severity: "high",
                    title: "No HTTP→HTTPS redirect",
                    detail: "http:// still serves without sending users to HTTPS.",
                    difficulty: "easy",
                    fix: "301 http:// to https:// at the edge (and enable HSTS after).",
                });
            }
        } catch (err) {
            httpToHttps = `skip: ${err instanceof Error ? err.message : "failed"}`;
            checks.push(
                check("http-https", "HTTP → HTTPS redirect", "skip", httpToHttps),
            );
        }
    }

    checks.push(
        check("tls", "SSL/TLS", isHttps ? "pass" : "fail", isHttps ? "HTTPS URL" : "HTTP URL"),
        check("status", "Response status codes", res.status < 400 ? "pass" : "fail", String(res.status)),
        check("ttfb", "Response time", ttfbMs > 2500 ? "warn" : "pass", `${ttfbMs}ms TTFB (this fetch)`),
        check("page-size", "Page size", bytes > 1_500_000 ? "warn" : "pass", `${bytes.toLocaleString()} HTML bytes`),
        check(
            "hsts",
            "HSTS",
            hsts ? "pass" : "fail",
            hsts ?? "missing Strict-Transport-Security",
        ),
        check("csp", "CSP", csp ? "pass" : "fail", csp ? "present" : "missing Content-Security-Policy"),
        check(
            "xcto",
            "X-Content-Type-Options",
            xcto && /nosniff/i.test(xcto) ? "pass" : "fail",
            xcto ?? "missing",
        ),
        check(
            "referrer",
            "Referrer-Policy",
            referrerPolicy ? "pass" : "warn",
            referrerPolicy ?? "missing",
        ),
        check(
            "permissions",
            "Permissions-Policy",
            permissionsPolicy ? "pass" : "warn",
            permissionsPolicy ? "present" : "missing",
        ),
        check(
            "xfo",
            "X-Frame-Options / frame-ancestors",
            xfo || (csp && /frame-ancestors/i.test(csp)) ? "pass" : "warn",
            xfo ?? (csp && /frame-ancestors/i.test(csp) ? "CSP frame-ancestors" : "missing"),
        ),
        check(
            "compression",
            "Compression: gzip/Brotli",
            encoding && /gzip|br|deflate/i.test(encoding) ? "pass" : "warn",
            encoding ?? "no Content-Encoding (may still compress for browsers)",
        ),
        check(
            "cache",
            "Cache headers",
            cacheControl ? "info" : "warn",
            cacheControl ?? "no Cache-Control",
        ),
        check(
            "cdn",
            "CDN detection",
            cdnHints.length ? "info" : "info",
            cdnHints.length ? unique(cdnHints).join(", ") : "no common CDN headers",
        ),
        check(
            "server",
            "Server/header information",
            powered ? "warn" : "info",
            [server && `Server: ${server}`, powered && `X-Powered-By: ${powered}`]
                .filter(Boolean)
                .join("; ") || "no Server / X-Powered-By",
        ),
    );

    if (!isHttps) {
        secDeduct.push(40);
        find(findings, {
            category: "security",
            severity: "critical",
            title: "Not HTTPS",
            detail: "Page served over HTTP.",
            difficulty: "medium",
            fix: "Terminate TLS, serve only HTTPS, then add HSTS.",
        });
    } else secNotes.push("HTTPS in use.");
    if (!hsts) {
        secDeduct.push(12);
        find(findings, {
            category: "security",
            severity: "medium",
            title: "Missing HSTS",
            detail: "No Strict-Transport-Security header.",
            difficulty: "easy",
            fix: "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` on HTTPS responses.",
        });
    } else secNotes.push("HSTS present.");
    if (!csp) {
        secDeduct.push(10);
        find(findings, {
            category: "security",
            severity: "medium",
            title: "Missing CSP",
            detail: "No Content-Security-Policy header.",
            difficulty: "medium",
            fix: "Add a Content-Security-Policy (start with Report-Only, then enforce default-src/script-src).",
        });
    } else secNotes.push("CSP present.");
    if (!xcto || !/nosniff/i.test(xcto)) {
        secDeduct.push(4);
        find(findings, {
            category: "security",
            severity: "low",
            title: "Missing X-Content-Type-Options",
            detail: "nosniff not set.",
            difficulty: "easy",
            fix: "Add `X-Content-Type-Options: nosniff`.",
        });
    }
    if (!referrerPolicy) {
        secDeduct.push(3);
        find(findings, {
            category: "security",
            severity: "low",
            title: "Missing Referrer-Policy",
            detail: "Referrer-Policy header absent.",
            difficulty: "easy",
            fix: "Add `Referrer-Policy: strict-origin-when-cross-origin`.",
        });
    }
    if (!permissionsPolicy) {
        secDeduct.push(2);
        find(findings, {
            category: "security",
            severity: "low",
            title: "Missing Permissions-Policy",
            detail: "Permissions-Policy header absent.",
            difficulty: "easy",
            fix: "Add a Permissions-Policy denying unused powerful features (camera, mic, geolocation).",
        });
    }
    if (!xfo && !(csp && /frame-ancestors/i.test(csp))) {
        secDeduct.push(6);
        find(findings, {
            category: "security",
            severity: "medium",
            title: "Clickjacking headers missing",
            detail: "No X-Frame-Options and no CSP frame-ancestors.",
            difficulty: "easy",
            fix: "Set `Content-Security-Policy: frame-ancestors 'self'` (or X-Frame-Options: DENY).",
        });
    }
    if (powered) {
        secDeduct.push(2);
        find(findings, {
            category: "security",
            severity: "info",
            title: "X-Powered-By exposed",
            detail: powered,
            difficulty: "easy",
            fix: "Remove X-Powered-By from origin responses.",
        });
    }
    if (/<script[^>]+src=["']http:/i.test(html)) {
        secDeduct.push(15);
        find(findings, {
            category: "security",
            severity: "high",
            title: "Mixed content scripts",
            detail: "HTTP script sources found.",
            difficulty: "medium",
            fix: "Load all scripts over HTTPS; enable upgrade-insecure-requests in CSP.",
        });
    }

    const scriptSrcs = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
    const cssHrefs = [
        ...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi),
    ]
        .map((m) => attr(m[0], "href"))
        .filter((x): x is string => Boolean(x));
    const imgSrcs = [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
    const iframeSrcs = [...html.matchAll(/<iframe\b[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
    const resourceUrls = unique(
        [...scriptSrcs, ...cssHrefs, ...imgSrcs, ...iframeSrcs]
            .map((u) => {
                try {
                    return new URL(u, finalUrl).href;
                } catch {
                    return "";
                }
            })
            .filter(Boolean),
    );
    const thirdParty = resourceUrls.filter((u) => hostOf(u) && hostOf(u) !== finalHost);
    const jsCount = countMatches(html, /<script\b/gi);
    const cssCount = cssHrefs.length;
    checks.push(
        check("js-count", "JavaScript count", jsCount > 25 ? "warn" : "pass", `${jsCount} <script>`),
        check("css-count", "CSS count", cssCount > 8 ? "warn" : "pass", `${cssCount} stylesheets`),
        check(
            "requests",
            "Number of requests",
            resourceUrls.length > 80 ? "warn" : "info",
            `${resourceUrls.length} src/href resources in HTML (not a full waterfall)`,
        ),
        check(
            "third-party",
            "Third-party requests",
            thirdParty.length > 15 ? "warn" : "info",
            `${thirdParty.length} third-party resource URLs`,
        ),
    );
    if (bytes > 1_500_000) {
        perfDeduct.push(25);
        find(findings, {
            category: "performance",
            severity: "high",
            title: "Large HTML response",
            detail: `${(bytes / 1_000_000).toFixed(1)} MB document.`,
            difficulty: "medium",
            fix: "Trim HTML, defer non-critical markup, paginate or stream content.",
        });
    } else if (bytes > 500_000) perfDeduct.push(12);
    if (jsCount > 25) {
        perfDeduct.push(18);
        find(findings, {
            category: "performance",
            severity: "medium",
            title: "Many script tags",
            detail: `${jsCount} <script> tags.`,
            difficulty: "medium",
            fix: "Bundle/defer scripts; drop unused third-party tags.",
        });
    } else if (jsCount > 12) perfDeduct.push(8);
    if (cssCount > 8) perfDeduct.push(6);
    if (ttfbMs > 2500) {
        perfDeduct.push(10);
        find(findings, {
            category: "performance",
            severity: "medium",
            title: "Slow TTFB",
            detail: `${ttfbMs}ms for this fetch.`,
            difficulty: "hard",
            fix: "Cache at the edge, speed origin TTFB, enable compression.",
        });
    }
    if (encoding && !/gzip|br|deflate/i.test(encoding)) {
        perfDeduct.push(6);
    } else if (!encoding) {
        perfDeduct.push(4);
        perfNotes.push("No Content-Encoding on this fetch (some CDNs still gzip browsers).");
    }
    if (!cacheControl) perfDeduct.push(3);
    const imgsMissingDim = [...html.matchAll(/<img\b[^>]*>/gi)].filter((m) => {
        const tag = m[0];
        return !/\bwidth\s*=/i.test(tag) || !/\bheight\s*=/i.test(tag);
    }).length;
    if (imgsMissingDim > 5) {
        perfDeduct.push(6);
        perfNotes.push(`${imgsMissingDim} images lack width/height (CLS risk).`);
    }
    perfNotes.push(
        `${bytes.toLocaleString()} HTML bytes, TTFB ${ttfbMs}ms, ${jsCount} scripts, ${cssCount} CSS, ~${resourceUrls.length} HTML resources, ${thirdParty.length} third-party.`,
    );

    const title = extractTitle(html);
    const description = metaContent(html, "description");
    const canonicalTag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0];
    const canonical = canonicalTag ? attr(canonicalTag, "href") : null;
    const robots = metaContent(html, "robots");
    const ogTitle = metaContent(html, "og:title");
    const ogDesc = metaContent(html, "og:description");
    const ogImage = metaContent(html, "og:image");
    const twitterCard = metaContent(html, "twitter:card");
    const twitterTitle = metaContent(html, "twitter:title");
    const viewport = metaContent(html, "viewport");
    const h1Count = countMatches(html, /<h1\b/gi);
    const h2Count = countMatches(html, /<h2\b/gi);
    const schemaBlocks = countMatches(
        html,
        /<script[^>]+type=["']application\/ld\+json["']/gi,
    );
    const microdata = /\bitemtype=/i.test(html);

    checks.push(
        check("title", "Meta title", title ? "pass" : "fail", title ? `"${title.slice(0, 80)}"` : "missing"),
        check(
            "description",
            "Meta description",
            description ? "pass" : "fail",
            description ? `${description.length} chars` : "missing",
        ),
        check("canonical", "Canonical tag", canonical ? "pass" : "warn", canonical ?? "missing"),
        check("robots-meta", "Robots meta tag", robots && /noindex/i.test(robots) ? "fail" : "pass", robots ?? "not set"),
        check(
            "h1h2",
            "H1/H2 structure",
            h1Count === 1 ? "pass" : "warn",
            `${h1Count} H1 · ${h2Count} H2`,
        ),
        check(
            "og",
            "Open Graph tags",
            ogTitle && ogImage ? "pass" : "warn",
            `og:title ${ogTitle ? "yes" : "no"} · og:description ${ogDesc ? "yes" : "no"} · og:image ${ogImage ? "yes" : "no"}`,
        ),
        check(
            "twitter",
            "Twitter/X card tags",
            twitterCard ? "pass" : "warn",
            twitterCard ? `${twitterCard}${twitterTitle ? ` · ${twitterTitle.slice(0, 40)}` : ""}` : "missing twitter:card",
        ),
        check(
            "schema",
            "Schema markup",
            schemaBlocks || microdata ? "pass" : "info",
            `${schemaBlocks} JSON-LD · microdata ${microdata ? "yes" : "no"}`,
        ),
        check(
            "viewport",
            "Mobile viewport meta tag",
            viewport ? "pass" : "fail",
            viewport ?? "missing",
        ),
    );

    if (!title) {
        seoDeduct.push(25);
        find(findings, {
            category: "seo",
            severity: "high",
            title: "Missing <title>",
            detail: "No document title.",
            difficulty: "easy",
            fix: "Add a unique 15–60 character `<title>` describing the page.",
        });
    } else if (title.length < 10 || title.length > 70) {
        seoDeduct.push(8);
        seoNotes.push(`Title length ${title.length} (prefer ~15–60).`);
    }
    if (!description) {
        seoDeduct.push(15);
        find(findings, {
            category: "seo",
            severity: "medium",
            title: "Missing meta description",
            detail: "No name=description.",
            difficulty: "easy",
            fix: "Add `<meta name=\"description\" content=\"…\">` (~120–160 characters).",
        });
    }
    if (h1Count === 0) {
        seoDeduct.push(12);
        find(findings, {
            category: "seo",
            severity: "medium",
            title: "No H1",
            detail: "Page has no <h1>.",
            difficulty: "easy",
            fix: "Add one H1 that matches search intent; nest H2s under it.",
        });
    } else if (h1Count > 1) {
        seoDeduct.push(6);
        seoNotes.push(`${h1Count} H1s (prefer one).`);
    }
    if (!canonical) {
        seoDeduct.push(6);
        find(findings, {
            category: "seo",
            severity: "low",
            title: "No canonical",
            detail: "rel=canonical missing.",
            difficulty: "easy",
            fix: `Add a rel=canonical link pointing at ${finalUrl}.`,
        });
    }
    if (!ogTitle || !ogImage) {
        seoDeduct.push(5);
        find(findings, {
            category: "seo",
            severity: "low",
            title: "Incomplete Open Graph",
            detail: `og:title ${ogTitle ? "yes" : "no"}, og:image ${ogImage ? "yes" : "no"}.`,
            difficulty: "easy",
            fix: "Set og:title, og:description, og:image, og:url for link previews.",
        });
    }
    if (!twitterCard) seoDeduct.push(3);
    if (!viewport) {
        seoDeduct.push(10);
        find(findings, {
            category: "seo",
            severity: "medium",
            title: "Missing viewport meta",
            detail: "No mobile viewport tag.",
            difficulty: "easy",
            fix: "Add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">`.",
        });
    }
    if (robots && /noindex/i.test(robots)) {
        seoDeduct.push(20);
        find(findings, {
            category: "seo",
            severity: "high",
            title: "noindex",
            detail: `robots meta: ${robots}`,
            difficulty: "easy",
            fix: "Remove noindex if the page should be indexed; keep it if this URL is meant to stay out of search.",
        });
    }
    if (!html) {
        seoDeduct.push(40);
        seoNotes.push("Non-HTML or empty body — SEO signals unavailable.");
    }

    const htmlTag = html.match(/<html\b[^>]*>/i)?.[0];
    const lang = htmlTag ? attr(htmlTag, "lang") : null;
    const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    const missingAlt = imgTags.filter((tag) => !/\balt\s*=/i.test(tag)).length;
    const inputs = [...html.matchAll(/<input\b[^>]*>/gi)].map((m) => m[0]);
    const labels = countMatches(html, /<label\b/gi);
    const unlabeled = inputs.filter((tag) => {
        const type = (attr(tag, "type") ?? "text").toLowerCase();
        if (["hidden", "submit", "button", "image"].includes(type)) return false;
        const id = attr(tag, "id");
        if (id && html.includes(`for="${id}"`)) return false;
        if (/\baria-label=/i.test(tag) || /\baria-labelledby=/i.test(tag)) return false;
        return true;
    }).length;
    const ariaCount = countMatches(html, /\baria-[a-z]+=/gi);
    checks.push(
        check("lang", "html lang", lang ? "pass" : "fail", lang ?? "missing"),
        check(
            "alt",
            "Missing alt attributes from HTML",
            missingAlt ? "fail" : "pass",
            `${missingAlt} of ${imgTags.length} images lack alt`,
        ),
        check(
            "labels",
            "Form labels",
            unlabeled > 0 ? "fail" : "pass",
            unlabeled > 0
                ? `${unlabeled} inputs without label/aria-label (${labels} <label>)`
                : `${labels} <label> · inputs look labeled`,
        ),
        check(
            "aria",
            "ARIA/basic accessibility checks",
            "info",
            `${ariaCount} aria-* attrs · main ${/<main\b/i.test(html) || /\brole=["']main["']/i.test(html) ? "yes" : "no"}`,
        ),
    );
    if (!lang) {
        a11yDeduct.push(12);
        find(findings, {
            category: "accessibility",
            severity: "medium",
            title: "Missing lang",
            detail: "<html> lacks lang.",
            difficulty: "easy",
            fix: "Set `<html lang=\"en\">` (or the page language).",
        });
    }
    if (missingAlt > 0) {
        a11yDeduct.push(Math.min(30, 4 + missingAlt * 2));
        find(findings, {
            category: "accessibility",
            severity: missingAlt > 5 ? "high" : "medium",
            title: "Images missing alt",
            detail: `${missingAlt} of ${imgTags.length} <img> lack alt.`,
            difficulty: "easy",
            fix: "Add alt text (empty alt=\"\" only for decorative images).",
        });
    }
    if (unlabeled > 0) {
        a11yDeduct.push(10);
        find(findings, {
            category: "accessibility",
            severity: "medium",
            title: "Unlabeled form controls",
            detail: `${unlabeled} inputs without label or aria-label.`,
            difficulty: "easy",
            fix: "Associate each control with a <label for> or aria-label.",
        });
    }
    if (!/<main\b/i.test(html) && !/\brole=["']main["']/i.test(html)) {
        a11yDeduct.push(4);
        a11yNotes.push("No <main> landmark.");
    }
    a11yNotes.push("Static HTML only — no axe/keyboard/screen-reader run.");

    const trackers = scriptSrcs.filter((src) => TRACKER_HOST_RE.test(src));
    const cookieCount = (setCookie?.match(/,/g)?.length ?? 0) + (setCookie ? 1 : 0);
    checks.push(
        check(
            "trackers",
            "Tracker detection",
            trackers.length ? "warn" : "pass",
            trackers.length
                ? unique(
                      trackers.map((u) => {
                          try {
                              return new URL(u, finalUrl).hostname;
                          } catch {
                              return u.slice(0, 40);
                          }
                      }),
                  )
                      .slice(0, 8)
                      .join(", ")
                : "no common tracker hosts in script src",
        ),
        check(
            "cookies",
            "Cookie detection",
            setCookie ? "info" : "pass",
            setCookie
                ? `Set-Cookie present (${cookieCount} cookie header value(s)); Secure=${/;\s*Secure/i.test(setCookie) ? "yes" : "no"} HttpOnly=${/;\s*HttpOnly/i.test(setCookie) ? "yes" : "no"}`
                : "no Set-Cookie on this response",
        ),
    );
    if (trackers.length) {
        privDeduct.push(Math.min(40, 10 + trackers.length * 8));
        find(findings, {
            category: "privacy",
            severity: "medium",
            title: "Likely trackers",
            detail: `${trackers.length} script host(s) match tracker patterns.`,
            difficulty: "medium",
            fix: "Load analytics only after consent; prefer first-party / server-side tagging.",
        });
    }
    if (/gtag\(|fbq\(|dataLayer/i.test(html)) {
        privDeduct.push(8);
        privNotes.push("Inline analytics snippets detected.");
    }
    if (setCookie && isHttps && !/;\s*Secure/i.test(setCookie)) {
        privDeduct.push(6);
        find(findings, {
            category: "privacy",
            severity: "medium",
            title: "Cookie missing Secure",
            detail: "Set-Cookie without Secure on HTTPS.",
            difficulty: "easy",
            fix: "Add Secure; HttpOnly; SameSite=Lax (or Strict) on session cookies.",
        });
    }

    const anchors = [...html.matchAll(/<a\b([^>]*)href=["']([^"']*)["']([^>]*)>/gi)];
    const hrefs = anchors.map((m) => m[2].trim());
    const nofollow = anchors.filter((m) =>
        /rel=["'][^"']*nofollow/i.test(`${m[1]} ${m[3]}`),
    ).length;
    const emptyOrHash = hrefs.filter(
        (h) => !h || h === "#" || h.toLowerCase().startsWith("javascript:"),
    ).length;
    let internal = 0;
    let external = 0;
    const resolvedHrefs: string[] = [];
    for (const h of hrefs) {
        if (!h || h.startsWith("#") || h.toLowerCase().startsWith("javascript:")) continue;
        try {
            const u = new URL(h, finalUrl);
            resolvedHrefs.push(u.href);
            if (u.hostname === finalHost) internal += 1;
            else external += 1;
        } catch {
            // ignore
        }
    }
    const dupes = resolvedHrefs.filter((h, i) => resolvedHrefs.indexOf(h) !== i);
    const dupeCount = unique(dupes).length;
    const mailto = hrefs.filter((h) => h.toLowerCase().startsWith("mailto:")).length;
    const tel = hrefs.filter((h) => h.toLowerCase().startsWith("tel:")).length;

    const sampleLinks = unique(
        resolvedHrefs.filter((u) => {
            try {
                const p = new URL(u);
                return p.protocol === "https:" || p.protocol === "http:";
            } catch {
                return false;
            }
        }),
    ).slice(0, 8);
    const sampleAssets = resourceUrls.filter((u) => hostOf(u) === finalHost).slice(0, 6);
    const broken: string[] = [];
    const deadAssets: string[] = [];
    await Promise.all(
        sampleLinks.map(async (u) => {
            try {
                assertPublicHttpUrl(u);
                const status = await headOrGet(u);
                if (status != null && status >= 400) broken.push(`${status} ${u}`);
            } catch {
                broken.push(`error ${u}`);
            }
        }),
    );
    await Promise.all(
        sampleAssets.map(async (u) => {
            try {
                assertPublicHttpUrl(u);
                const status = await headOrGet(u);
                if (status != null && status >= 400) deadAssets.push(`${status} ${u}`);
            } catch {
                deadAssets.push(`error ${u}`);
            }
        }),
    );
    checks.push(
        check(
            "broken-links",
            "Broken links",
            broken.length ? "fail" : "pass",
            sampleLinks.length
                ? `${broken.length} of ${sampleLinks.length} sampled links failed${broken.length ? `: ${broken.slice(0, 4).join("; ")}` : ""}`
                : "no http(s) links to sample",
        ),
        check(
            "dead-assets",
            "Dead assets",
            deadAssets.length ? "fail" : "pass",
            sampleAssets.length
                ? `${deadAssets.length} of ${sampleAssets.length} sampled same-origin assets failed`
                : "no same-origin assets to sample",
        ),
        check(
            "internal-external",
            "Internal vs external links",
            "info",
            `${internal} internal · ${external} external · ${hrefs.length} anchors`,
        ),
        check("nofollow", "No-follow links", "info", `${nofollow} rel=nofollow anchors`),
        check(
            "dup-links",
            "Duplicate links",
            dupeCount > 8 ? "warn" : "info",
            `${dupeCount} duplicated href(s)`,
        ),
        check(
            "contact-links",
            "Email/phone links",
            mailto || tel ? "pass" : "info",
            `${mailto} mailto: · ${tel} tel:`,
        ),
    );
    if (broken.length) {
        linkDeduct.push(Math.min(25, broken.length * 6));
        find(findings, {
            category: "links",
            severity: "medium",
            title: "Broken links (sample)",
            detail: broken.slice(0, 5).join("; "),
            difficulty: "easy",
            fix: "Update or remove URLs that return 4xx/5xx.",
        });
    }
    if (deadAssets.length) {
        linkDeduct.push(Math.min(15, deadAssets.length * 5));
        find(findings, {
            category: "links",
            severity: "medium",
            title: "Dead assets (sample)",
            detail: deadAssets.slice(0, 5).join("; "),
            difficulty: "easy",
            fix: "Fix script/img/css URLs that 404.",
        });
    }
    if (emptyOrHash > 0) {
        linkDeduct.push(Math.min(20, emptyOrHash * 2));
        find(findings, {
            category: "links",
            severity: "low",
            title: "Placeholder links",
            detail: `${emptyOrHash} empty/#/javascript hrefs.`,
            difficulty: "easy",
            fix: "Give every actionable anchor a real URL.",
        });
    }
    linkNotes.push(
        `${hrefs.length} anchors · ${internal} internal · ${external} external · ${nofollow} nofollow · sampled ${sampleLinks.length} links / ${sampleAssets.length} assets.`,
    );

    const forms = countMatches(html, /<form\b/gi);
    const buttons = countMatches(html, /<button\b/gi);
    const ctaHits = countMatches(html, CTA_RE);
    const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
        .map((m) => m[1])
        .join(" ");
    const hasOrgSchema = /"@type"\s*:\s*"(Organization|LocalBusiness|Person)"/i.test(jsonLd);
    checks.push(
        check("forms", "Forms detected", forms ? "info" : "info", `${forms} <form> · ${buttons} <button>`),
        check(
            "cta",
            "CTA text detected from HTML",
            ctaHits ? "pass" : "warn",
            `${ctaHits} CTA-like phrase hits`,
        ),
        check(
            "contact-schema",
            "Structured contact information",
            hasOrgSchema || mailto || tel ? "pass" : "info",
            hasOrgSchema
                ? "JSON-LD Organization/LocalBusiness/Person"
                : mailto || tel
                  ? "mailto/tel only"
                  : "none detected",
        ),
    );
    if (forms === 0 && ctaHits === 0) {
        convDeduct.push(20);
        find(findings, {
            category: "conversion",
            severity: "low",
            title: "No forms or CTA copy",
            detail: "No <form> and no common CTA phrases in HTML.",
            difficulty: "medium",
            fix: "Add a clear primary CTA and a reachable form or contact path.",
        });
    } else {
        convNotes.push(`${forms} form(s), ${buttons} button(s), CTA-like hits: ${ctaHits}.`);
    }

    const generator = metaContent(html, "generator");
    const wp = WP_RE.test(html) || /wordpress/i.test(generator ?? "");
    const stackBits = [
        generator && `generator: ${generator}`,
        wp && "WordPress signals",
        /next\.js|__NEXT_DATA__/i.test(html) && "Next.js",
        /wp-content/i.test(html) && "wp-content",
        server,
    ].filter(Boolean);
    checks.push(
        check(
            "stack",
            "Technology/stack detection",
            "info",
            stackBits.join("; ") || "no strong fingerprint",
        ),
        check(
            "wordpress",
            "WordPress/plugin detection",
            wp ? "info" : "pass",
            wp ? "WordPress paths or generator meta present" : "no WordPress fingerprint",
        ),
    );

    const suspiciousExt = thirdParty.filter(
        (u) => SUSPICIOUS_TLD_RE.test(u) || /^\d+\.\d+\.\d+\.\d+$/.test(hostOf(u)),
    );
    const ipHost = /^\d+\.\d+\.\d+\.\d+$/.test(finalHost);
    checks.push(
        check(
            "suspicious",
            "Suspicious external domains",
            suspiciousExt.length ? "warn" : "pass",
            suspiciousExt.length
                ? unique(suspiciousExt.map(hostOf)).slice(0, 6).join(", ")
                : "no high-risk TLD / raw-IP third parties in HTML resources",
        ),
        check(
            "malware",
            "Known malicious URL/domain checks",
            "skip",
            "No Safe Browsing / blocklist API configured — heuristic TLD/IP only",
        ),
    );
    if (ipHost) {
        repDeduct.push(15);
        find(findings, {
            category: "reputation",
            severity: "medium",
            title: "Site served on raw IP",
            detail: finalHost,
            difficulty: "medium",
            fix: "Serve on a proper hostname with a valid certificate.",
        });
    }
    if (suspiciousExt.length) {
        repDeduct.push(8);
        find(findings, {
            category: "reputation",
            severity: "medium",
            title: "Suspicious third-party hosts",
            detail: unique(suspiciousExt.map(hostOf)).slice(0, 5).join(", "),
            difficulty: "medium",
            fix: "Review and remove unexpected third-party scripts.",
        });
    }

    const probePaths = [
        "/.env",
        "/.git/HEAD",
        "/wp-login.php",
        "/xmlrpc.php",
        "/server-status",
        "/.well-known/security.txt",
        "/security.txt",
    ];
    const exposed: string[] = [];
    let securityTxt = "missing";
    await Promise.all(
        probePaths.map(async (path) => {
            const target = `${origin}${path}`;
            try {
                assertPublicHttpUrl(target);
                const hit = await publicFetch(target, { timeoutMs: 5_000 });
                const interesting =
                    hit.status === 200 &&
                    hit.bytes > 8 &&
                    !/text\/html/i.test(hdr(hit.headers, "content-type") ?? "");
                if (path.endsWith("security.txt")) {
                    if (hit.status === 200 && hit.bytes > 8) {
                        securityTxt = `${path} (${hit.status})`;
                    }
                    return;
                }
                if (interesting || (hit.status === 200 && /\.env|git\/HEAD|xmlrpc|wp-login/.test(path))) {
                    if (hit.status === 200 && (interesting || /wp-login|xmlrpc/.test(path))) {
                        exposed.push(`${hit.status} ${path}`);
                    }
                }
            } catch {
                // ignore
            }
        }),
    );
    checks.push(
        check(
            "exposed",
            "Exposed files/directories",
            exposed.length ? "fail" : "pass",
            exposed.length ? exposed.join("; ") : "common sensitive paths not publicly readable (sampled)",
        ),
        check(
            "security-txt",
            "Security.txt",
            securityTxt === "missing" ? "warn" : "pass",
            securityTxt,
        ),
    );
    if (exposed.length) {
        secDeduct.push(20);
        find(findings, {
            category: "security",
            severity: "high",
            title: "Exposed sensitive path",
            detail: exposed.join("; "),
            difficulty: "medium",
            fix: "Block these paths at the origin/CDN; rotate any secrets if .env leaked.",
        });
    }
    if (securityTxt === "missing") {
        find(findings, {
            category: "security",
            severity: "info",
            title: "No security.txt",
            detail: "/.well-known/security.txt not found.",
            difficulty: "easy",
            fix: "Publish a security.txt with a contact (RFC 9116).",
        });
    }

    let robotsBody = "";
    let robotsStatus = 0;
    try {
        const robotsHit = await publicFetch(`${origin}/robots.txt`, { timeoutMs: 6_000 });
        robotsStatus = robotsHit.status;
        robotsBody = robotsHit.body.slice(0, 8_000);
    } catch {
        robotsStatus = 0;
    }
    const sitemapFromRobots = [
        ...robotsBody.matchAll(/^sitemap:\s*(\S+)/gim),
    ].map((m) => m[1]);
    let sitemapStatus = 0;
    const sitemapUrl = sitemapFromRobots[0] ?? `${origin}/sitemap.xml`;
    try {
        if (sitemapUrl.startsWith("http")) {
            assertPublicHttpUrl(sitemapUrl);
            const sm = await publicFetch(sitemapUrl, { timeoutMs: 6_000 });
            sitemapStatus = sm.status;
        }
    } catch {
        sitemapStatus = 0;
    }
    const robotsDisallowAll = /^\s*disallow:\s*\/\s*$/im.test(robotsBody);
    checks.push(
        check(
            "robots-txt",
            "robots.txt",
            robotsStatus === 200 ? "pass" : "warn",
            robotsStatus === 200
                ? `${robotsBody.split("\n").length} lines${robotsDisallowAll ? " · Disallow: /" : ""}`
                : `HTTP ${robotsStatus || "fail"}`,
        ),
        check(
            "sitemap",
            "sitemap.xml",
            sitemapStatus === 200 ? "pass" : "warn",
            sitemapStatus === 200 ? sitemapUrl : `${sitemapUrl} → HTTP ${sitemapStatus || "fail"}`,
        ),
        check(
            "indexing",
            "Page indexing checks",
            robots && /noindex/i.test(robots) || robotsDisallowAll ? "fail" : "info",
            `meta robots=${robots ?? "unset"} · robots.txt Disallow:/ ${robotsDisallowAll ? "yes" : "no"} · no live Google index API`,
        ),
    );
    if (robotsStatus !== 200) {
        seoDeduct.push(4);
        seoNotes.push("robots.txt missing or not 200.");
    }
    if (sitemapStatus !== 200) {
        seoDeduct.push(4);
        seoNotes.push("sitemap.xml not reachable.");
    }

    const [spfTxt, dmarcTxt, dkimGoogle, dkimDefault, dkimSel1, created] =
        await Promise.all([
            dnsTxt(registrable),
            dnsTxt(`_dmarc.${registrable}`),
            dnsTxt(`google._domainkey.${registrable}`),
            dnsTxt(`default._domainkey.${registrable}`),
            dnsTxt(`selector1._domainkey.${registrable}`),
            rdapCreated(registrable),
        ]);
    const spf = spfTxt.find((t) => /v=spf1/i.test(t));
    const dmarc = dmarcTxt.find((t) => /v=dmarc1/i.test(t));
    const dkim = [...dkimGoogle, ...dkimDefault, ...dkimSel1].find((t) =>
        /v=DKIM1|p=/i.test(t),
    );
    checks.push(
        check("dns-spf", "SPF", spf ? "pass" : "warn", spf ? spf.slice(0, 120) : "no v=spf1 TXT on apex"),
        check(
            "dns-dkim",
            "DKIM",
            dkim ? "pass" : "info",
            dkim
                ? "DKIM TXT on google/default/selector1._domainkey"
                : "no DKIM at common selectors (google, default, selector1)",
        ),
        check(
            "dns-dmarc",
            "DMARC",
            dmarc ? "pass" : "warn",
            dmarc ? dmarc.slice(0, 120) : "no v=DMARC1 on _dmarc",
        ),
        check(
            "domain-age",
            "Domain age/reputation signals",
            created ? "info" : "skip",
            created
                ? `RDAP registration ${created.slice(0, 10)} (not a blocklist reputation score)`
                : "RDAP lookup unavailable",
        ),
    );
    if (!spf) {
        repDeduct.push(6);
        find(findings, {
            category: "reputation",
            severity: "low",
            title: "No SPF",
            detail: `No v=spf1 TXT on ${registrable}.`,
            difficulty: "easy",
            fix: "Publish an SPF TXT record for sending domains.",
        });
    }
    if (!dmarc) {
        repDeduct.push(6);
        find(findings, {
            category: "reputation",
            severity: "low",
            title: "No DMARC",
            detail: `No _dmarc.${registrable} record.`,
            difficulty: "easy",
            fix: "Add `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain` then tighten p=quarantine/reject.",
        });
    }
    if (!isHttps) repDeduct.push(35);
    if (trackers.length > 3) repDeduct.push(10);
    if (/password|ssn|credit.?card/i.test(html) && !isHttps) {
        repDeduct.push(25);
        find(findings, {
            category: "reputation",
            severity: "critical",
            title: "Sensitive fields on HTTP",
            detail: "Password/PII-like fields on a non-HTTPS page.",
            difficulty: "medium",
            fix: "Move the form behind HTTPS immediately.",
        });
    }
    if (res.status >= 400) {
        repDeduct.push(30);
        find(findings, {
            category: "reputation",
            severity: "high",
            title: `HTTP ${res.status}`,
            detail: "Document fetch returned an error status.",
            difficulty: "medium",
            fix: "Fix origin/CDN so the canonical URL returns 200.",
        });
    }
    checks.push(
        check("overall", "Overall score", "info", `${clamp(0)} placeholder`),
        check("categories", "Category scores", "info", "see table above"),
        check("priority", "Priority level per issue", "info", "P1–P5 on each finding"),
        check("difficulty", "Estimated fix difficulty", "info", "easy/medium/hard on each finding"),
        check("fix-instructions", "Exact fix instructions", "info", "Fix line on each finding"),
        check(
            "rescan",
            "Re-scan after fixes",
            "info",
            "Run /URL Doctor again on this URL",
        ),
        check(
            "history",
            "Historical score tracking",
            "skip",
            "Not stored across chats in this local tool",
        ),
        check(
            "schedule",
            "Scheduled monitoring",
            "skip",
            "No background worker in the local chat app",
        ),
        check(
            "alerts",
            "Alerts when something changes",
            "skip",
            "No alert channel in this tool",
        ),
    );

    const security = scoreFromDeductions(100, secDeduct);
    const performance = scoreFromDeductions(88, perfDeduct);
    const seo = scoreFromDeductions(html ? 100 : 60, seoDeduct);
    const accessibility = scoreFromDeductions(90, a11yDeduct);
    const privacy = scoreFromDeductions(92, privDeduct);
    const links = scoreFromDeductions(96, linkDeduct);
    const conversion = scoreFromDeductions(78, convDeduct);
    const reputation = scoreFromDeductions(90, repDeduct);

    const scores: UrlDoctorScore[] = [
        { category: "security", label: "Security", score: security, notes: secNotes },
        { category: "performance", label: "Performance", score: performance, notes: perfNotes },
        { category: "seo", label: "SEO", score: seo, notes: seoNotes },
        { category: "accessibility", label: "Accessibility", score: accessibility, notes: a11yNotes },
        { category: "privacy", label: "Privacy/Tracking", score: privacy, notes: privNotes },
        { category: "links", label: "Links", score: links, notes: linkNotes },
        { category: "conversion", label: "Conversion", score: conversion, notes: convNotes },
        { category: "reputation", label: "Reputation/risk", score: reputation, notes: repNotes },
    ];
    const weights: Record<UrlDoctorCategory, number> = {
        security: 1.2,
        performance: 1,
        seo: 1,
        accessibility: 1,
        privacy: 1,
        links: 0.7,
        conversion: 0.8,
        reputation: 1.1,
    };
    let wSum = 0;
    let sSum = 0;
    for (const s of scores) {
        const w = weights[s.category];
        wSum += w;
        sSum += s.score * w;
    }
    const overall = clamp(sSum / wSum);
    const overallCheck = checks.find((c) => c.id === "overall");
    if (overallCheck) overallCheck.result = `${overall}/100`;

    return {
        url: rawUrl,
        finalUrl,
        fetchedAt,
        status: res.status,
        contentType,
        bytes,
        ttfbMs,
        overall,
        scores,
        findings: findings.sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
            return order[a.severity] - order[b.severity];
        }),
        checks,
        limits: [
            "Document fetch plus bounded extras (robots, sitemap, security.txt, common sensitive paths, DNS TXT, RDAP, sample link/asset HEAD).",
            "Not a full-site crawl, Lighthouse lab run, or Google index API.",
            "Broken links/assets are a sample (≤8 links, ≤6 same-origin assets), not every URL.",
            "Malicious-domain check is heuristic only — no Safe Browsing feed.",
            "Scheduled monitoring, historical store, and alerts are not part of this chat tool.",
            "Client-rendered SPAs may look weak until HTML contains content.",
        ],
    };
}
