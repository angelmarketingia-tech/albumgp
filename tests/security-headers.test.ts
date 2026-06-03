import { describe, it, expect } from "vitest";
import {
  SECURITY_HEADERS,
  SECURITY_HEADERS_LIST,
  CONTENT_SECURITY_POLICY,
  securityHeadersForNextConfig,
} from "../lib/security/headers";

describe("SECURITY_HEADERS_LIST", () => {
  it("includes all mandated headers", () => {
    const keys = SECURITY_HEADERS_LIST.map((h) => h.key);
    expect(keys).toContain("Content-Security-Policy");
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Permissions-Policy");
  });

  it("does NOT include deprecated X-XSS-Protection", () => {
    const keys = SECURITY_HEADERS_LIST.map((h) => h.key);
    expect(keys).not.toContain("X-XSS-Protection");
  });

  it("X-Frame-Options is DENY", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });

  it("X-Content-Type-Options is nosniff", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("Referrer-Policy is strict-origin-when-cross-origin", () => {
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("HSTS has 2-year max-age, includeSubDomains and preload", () => {
    const hsts = SECURITY_HEADERS["Strict-Transport-Security"];
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("Permissions-Policy locks camera, geolocation, payment; allows mic on self (ElevenLabs voice)", () => {
    const pp = SECURITY_HEADERS["Permissions-Policy"] ?? "";
    expect(pp).toContain("camera=()");
    // El asistente de voz ElevenLabs requiere micrófono en este mismo origen.
    expect(pp).toContain("microphone=(self)");
    expect(pp).toContain("geolocation=()");
    expect(pp).toContain("payment=()");
  });
});

describe("CONTENT_SECURITY_POLICY", () => {
  it("contains all required directives", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self' 'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self' 'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).toContain("img-src 'self' data: blob:");
    expect(CONTENT_SECURITY_POLICY).toContain("font-src 'self' data:");
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
  });

  it("does not contain wildcards in default-src", () => {
    // default-src 'self' — sin '*' permitido
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/default-src[^;]*\*/);
  });
});

describe("securityHeadersForNextConfig()", () => {
  it("returns plain key/value objects (Next config format)", () => {
    const out = securityHeadersForNextConfig();
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(SECURITY_HEADERS_LIST.length);
    for (const h of out) {
      expect(typeof h.key).toBe("string");
      expect(typeof h.value).toBe("string");
      expect(h.value.length).toBeGreaterThan(0);
    }
  });
});
