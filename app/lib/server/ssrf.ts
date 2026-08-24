/**
 * SSRF guard for server-side fetch_url tool.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "metadata.goog",
]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const DNS_TIMEOUT_MS = 3_000;

function normalizeHostname(host: string): string {
    return host
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .replace(/\.+$/, "")
        .toLowerCase();
}

function parseIpv4(host: string): [number, number, number, number] | null {
    const parts = host.split(".");
    if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null;
    const octets = parts.map(Number);
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return null;
    }
    return octets as [number, number, number, number];
}

function isPrivateIpv4(host: string): boolean {
    const parts = parseIpv4(host);
    if (!parts) return false;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 192 && b === 2) return true;
    if (a === 198 && b === 51) return true;
    if (a === 203 && b === 0) return true;
    if (a >= 224) return true;
    return false;
}

function parseIpv6(host: string): bigint | null {
    const value = normalizeHostname(host);
    const sections = value.split("::");
    if (sections.length > 2) return null;

    const parseSection = (section: string): number[] => {
        if (!section) return [];
        const groups = section.split(":");
        const result: number[] = [];
        for (const group of groups) {
            if (group.includes(".")) {
                const ipv4 = parseIpv4(group);
                if (!ipv4) return [];
                result.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
            } else if (/^[0-9a-f]{1,4}$/i.test(group)) {
                result.push(Number.parseInt(group, 16));
            } else {
                return [];
            }
        }
        return result;
    };

    const left = parseSection(sections[0]);
    const right = sections.length === 2 ? parseSection(sections[1]) : [];
    if (left.length === 0 && sections[0] !== "") return null;
    if (right.length === 0 && sections.length === 2 && sections[1] !== "") return null;
    if (sections.length === 1 && left.length !== 8) return null;
    if (sections.length === 2 && left.length + right.length >= 8) return null;

    const groups = [
        ...left,
        ...Array(8 - left.length - right.length).fill(0),
        ...right,
    ];
    if (groups.length !== 8) return null;

    return groups.reduce((result, group) => (result << 16n) | BigInt(group), 0n);
}

function isPrivateIpv6(host: string): boolean {
    const value = parseIpv6(host);
    if (value === null) return true;
    if (value === 0n || value === 1n) return true;

    const firstGroup = Number((value >> 112n) & 0xffffn);
    if (firstGroup === 0 || (firstGroup >= 0xfc00 && firstGroup <= 0xfdff)) return true;
    if (firstGroup >= 0xfe80 && firstGroup <= 0xfeff) return true;
    if (firstGroup >= 0xff00) return true;

    // IPv4-mapped IPv6 addresses must inherit the IPv4 private-range check.
    if ((value >> 32n) === 0xffffn) {
        const ipv4 = Number(value & 0xffffffffn);
        const host4 = [
            (ipv4 >>> 24) & 255,
            (ipv4 >>> 16) & 255,
            (ipv4 >>> 8) & 255,
            ipv4 & 255,
        ].join(".");
        return isPrivateIpv4(host4);
    }
    return false;
}

function isPrivateIp(host: string): boolean {
    const normalized = normalizeHostname(host);
    const version = isIP(normalized);
    if (version === 4) return isPrivateIpv4(normalized);
    if (version === 6) return isPrivateIpv6(normalized);
    return false;
}

export function assertPublicHttpUrl(raw: string): void {
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error("Invalid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Only http(s) URLs are allowed");
    }
    if (parsed.username || parsed.password) {
        throw new Error("Credentials must not be embedded in the URL");
    }
    const host = normalizeHostname(parsed.hostname);
    if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".localhost")) {
        throw new Error("Private or local URLs are not allowed");
    }
    if (isPrivateIp(host)) {
        throw new Error("Private network URLs are not allowed");
    }
}

/**
 * Resolve a public hostname before a server-side fetch. This closes the
 * common DNS-to-private-address SSRF path while retaining the synchronous
 * guard for callers that only validate configuration.
 */
export async function assertPublicHttpUrlResolved(raw: string): Promise<void> {
    assertPublicHttpUrl(raw);
    const parsed = new URL(raw);
    const host = normalizeHostname(parsed.hostname);
    if (isIP(host)) return;

    let addresses: string[];
    try {
        addresses = await new Promise<string[]>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("DNS lookup timed out")), DNS_TIMEOUT_MS);
            void lookup(host, { all: true, verbatim: true }).then(
                (records) => {
                    clearTimeout(timer);
                    resolve(records.map(({ address }) => address));
                },
                (error: unknown) => {
                    clearTimeout(timer);
                    reject(error);
                },
            );
        });
    } catch {
        throw new Error("Could not resolve the URL host");
    }
    if (!addresses.length || addresses.some((address) => isPrivateIp(address))) {
        throw new Error("URL host resolves to a private network");
    }
}

/** Fetch a public URL while validating every redirect target. */
export async function fetchPublicHttpUrl(
    raw: string,
    init: RequestInit = {},
): Promise<Response> {
    let current = raw;
    const originalOrigin = new URL(raw).origin;
    const shouldFollow = init.redirect !== "manual" && init.redirect !== "error";

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        await assertPublicHttpUrlResolved(current);
        const response = await fetch(current, {
            ...init,
            redirect: "manual",
        });
        if (!shouldFollow || !REDIRECT_STATUSES.has(response.status)) return response;

        const location = response.headers.get("location");
        if (!location) return response;
        if (hop === MAX_REDIRECTS) throw new Error("Too many redirects");

        const next = new URL(location, current);
        const nextInit: RequestInit = { ...init };
        const currentMethod = (init.method ?? "GET").toUpperCase();
        if ([301, 302, 303].includes(response.status) && !["GET", "HEAD"].includes(currentMethod)) {
            nextInit.method = "GET";
            nextInit.body = undefined;
        }
        if (next.origin !== originalOrigin && init.headers) {
            const headers = new Headers(init.headers);
            headers.delete("authorization");
            headers.delete("cookie");
            headers.delete("proxy-authorization");
            headers.delete("host");
            headers.delete("x-api-key");
            headers.delete("x-auth-token");
            headers.delete("x-access-token");
            if (nextInit.method === "GET") {
                headers.delete("content-encoding");
                headers.delete("content-length");
                headers.delete("content-type");
                headers.delete("transfer-encoding");
            }
            nextInit.headers = headers;
        }
        init = nextInit;
        current = next.toString();
    }

    throw new Error("Too many redirects");
}
