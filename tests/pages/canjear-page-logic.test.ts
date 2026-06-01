// QA — logic-level tests for the no-SSO /canjear flow.
//
// `app/canjear/page.tsx` is an async server component with a server action.
// Following the same pattern as sobre-page-logic.test.ts, we test the CONTRACT
// the page depends on rather than rendering the async component:
//
//   1. `normalizeCode(decodeURIComponent(code))` — first step of readCode().
//   2. The redeem-result → `SIGNIN_URLS[country]` mapping that the server
//      action uses to redirect after consuming the code. This is the core new
//      behavior of the no-SSO flow (2026-06): no login in our app; we consume
//      the code (one-time-use) and bounce to GanaPlay's official login where the
//      prizes are already credited.
//
// The atomic one-time-use guarantee + idempotent replay are covered by
// api-redeem.test.ts (redeemCodeDirect is unchanged).

import { describe, expect, it } from "vitest";

import { SIGNIN_URLS } from "@/lib/brand/constants";
import { normalizeCode } from "@/lib/prizes";

// Mirrors the mapping inside redeemAction: on a successful redeem we redirect
// to the official GanaPlay login for the code's country.
function redirectTargetFor(country: "SV" | "GT"): string {
  return SIGNIN_URLS[country];
}

describe("/canjear — code normalization (readCode contract)", () => {
  it("normalizes a valid lowercase code", () => {
    expect(normalizeCode("ptsv5678ptsv5678")).toBe("PTSV5678PTSV5678");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCode("  PTSV5678PTSV5678  ")).toBe("PTSV5678PTSV5678");
  });

  it("rejects a malformed code (returns null → page redirects to /)", () => {
    expect(normalizeCode("not-a-code")).toBeNull();
    expect(normalizeCode("PTSV5678PTSV567")).toBeNull(); // 15 chars
  });
});

describe("/canjear — no-SSO redirect mapping", () => {
  it("SV redeem redirects to the official GanaPlay SV login", () => {
    expect(redirectTargetFor("SV")).toBe("https://ganaplay.sv/iniciar-sesion");
  });

  it("GT redeem redirects to the official GanaPlay GT login", () => {
    expect(redirectTargetFor("GT")).toBe("https://ganaplay.gt/iniciar-sesion");
  });

  it("covers both countries (no undefined redirect target)", () => {
    for (const country of ["SV", "GT"] as const) {
      const target = redirectTargetFor(country);
      expect(target).toMatch(/^https:\/\/ganaplay\.(sv|gt)\/iniciar-sesion$/);
    }
  });
});
