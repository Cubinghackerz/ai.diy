import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    DEFAULT_LWC_CLIENT_VERSION,
    compareClientVersions,
    resetClientVersionWarning,
    resolveClientVersion,
} from "~/lib/server/chatgpt-client-version";

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
    resetClientVersionWarning();
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("compareClientVersions", () => {
    it("orders by major, minor, patch numerically (not as strings)", () => {
        expect(compareClientVersions("0.162.1", "0.147.0")).toBeGreaterThan(0);
        expect(compareClientVersions("0.99.0", "0.100.0")).toBeLessThan(0);
        expect(compareClientVersions("1.0.0", "0.999.999")).toBeGreaterThan(0);
        expect(compareClientVersions("0.162.1", "0.162.1")).toBe(0);
        expect(compareClientVersions("0.170.0-alpha.1", "0.170.0")).toBe(0);
    });
});

describe("resolveClientVersion", () => {
    it("uses the built-in default when nothing is configured", () => {
        expect(resolveClientVersion(undefined)).toBe(DEFAULT_LWC_CLIENT_VERSION);
        expect(resolveClientVersion("   ")).toBe(DEFAULT_LWC_CLIENT_VERSION);
        expect(warn).not.toHaveBeenCalled();
    });

    it("honours a newer value, so the knob still works for the next Codex release", () => {
        expect(resolveClientVersion("0.170.2")).toBe("0.170.2");
        expect(resolveClientVersion(" 0.180.0-alpha.3 ")).toBe("0.180.0-alpha.3");
        expect(resolveClientVersion(DEFAULT_LWC_CLIENT_VERSION)).toBe(DEFAULT_LWC_CLIENT_VERSION);
        expect(warn).not.toHaveBeenCalled();
    });

    it("ignores an older value (the old .env.example suggested 0.147.0) and says so once", () => {
        expect(resolveClientVersion("0.147.0")).toBe(DEFAULT_LWC_CLIENT_VERSION);
        expect(resolveClientVersion("0.100.0")).toBe(DEFAULT_LWC_CLIENT_VERSION);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain("new models stay visible");
    });

    it("ignores a value that is not a version", () => {
        expect(resolveClientVersion("latest")).toBe(DEFAULT_LWC_CLIENT_VERSION);
    });
});
