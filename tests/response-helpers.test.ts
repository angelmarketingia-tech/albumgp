import { describe, it, expect } from "vitest";
import { genericError, ok } from "../lib/security/response";

describe("genericError", () => {
  it("returns the given status and only the error code in body", async () => {
    const res = genericError(404, "not_found_or_unavailable");
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "not_found_or_unavailable" });
    // No otros campos (no message, no stack, no detail).
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("attaches security headers on errors", () => {
    const res = genericError(429, "rate_limited");
    expect(res.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Strict-Transport-Security")).not.toBeNull();
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("supports each valid error code without leaking detail", async () => {
    const codes = [
      "invalid_input",
      "not_found_or_unavailable",
      "rate_limited",
      "conflict",
      "unauthenticated",
      "internal",
    ] as const;
    for (const code of codes) {
      const res = genericError(400, code);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe(code);
    }
  });
});

describe("ok", () => {
  it("returns status 200 with the data verbatim", async () => {
    const res = ok({ hello: "world", n: 42 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hello: string; n: number };
    expect(body).toEqual({ hello: "world", n: 42 });
  });

  it("attaches security headers on success", () => {
    const res = ok({ x: 1 });
    expect(res.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("handles arrays and primitives", async () => {
    const arr = ok([1, 2, 3]);
    expect(await arr.json()).toEqual([1, 2, 3]);
  });
});
