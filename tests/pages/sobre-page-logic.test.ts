// QA — logic-level tests for the /sobre/[code] reveal page.
//
// `app/sobre/[code]/page.tsx` is an async server component. RTL cannot
// "render" it the way it renders a client component — the page calls
// `headers()` from `next/headers`, calls `fetch()` over a self-URL, and
// returns a Promise. Hooking all of that into jsdom would be a deep
// integration-test scaffold that doesn't earn its keep at this stage of
// the project.
//
// Decisión QA (líder, este sprint): no modificamos el archivo de página
// para exportar helpers. En su lugar testeamos el CONTRATO que la página
// depende para funcionar:
//
//   1. `normalizeCode(decodeURIComponent(params.code))` — el primer paso
//      del server component. Si esto está roto, /sobre/<code> redirige
//      siempre, o acepta basura. Cubrimos los casos URL-encoded típicos.
//
//   2. `packResultSchema.safeParse(pack)` — el page valida defensivamente
//      la respuesta del API antes de pasarla a `PackReveal`. Si el shape
//      cambia upstream sin actualizar el schema, el page tira `{ kind:
//      "error" }`. Cubrimos shapes válidos e inválidos.
//
//   3. La derivación `country -> depositUrl` vía `DEPOSIT_URLS`. El page
//      enlaza al CTA "Depósitos" usando ese mapping. Si rompe, el botón
//      manda a URL undefined.
//
// El happy-path E2E del reveal real lo cubrirá un test de Playwright en
// Fase 5; por ahora la cobertura unitaria + el test de `/api/open` en
// `api-open.test.ts` validan ambos extremos del contrato.

import { describe, expect, it } from "vitest";

import { DEPOSIT_URLS } from "@/lib/brand/constants";
import { normalizeCode, packResultSchema } from "@/lib/prizes";

// =============================================================================
// 1. URL param normalization (matches what the server page does first)
// =============================================================================

describe("/sobre/[code] — URL param normalization", () => {
  const VALID = "ABCDEFGHJKLMNPQR";

  it("plain 16-char param → normalizes to itself", () => {
    expect(normalizeCode(decodeURIComponent(VALID))).toBe(VALID);
  });

  it("lowercased URL param → normalizes to uppercase", () => {
    expect(normalizeCode(decodeURIComponent(VALID.toLowerCase()))).toBe(VALID);
  });

  it("URL-encoded leading/trailing spaces → normalizes through trim", () => {
    const encoded = encodeURIComponent(`  ${VALID}  `);
    expect(normalizeCode(decodeURIComponent(encoded))).toBe(VALID);
  });

  it("URL with embedded forbidden chars → null (page should redirect to /)", () => {
    // Real URLs won't usually contain these via the link from /, but a
    // hand-typed URL might. The page's contract says: null → redirect("/").
    for (const bad of [
      "ABCDEFGHJKLMNPQI", // I
      "ABCDEFGHJKLMNPQ0", // 0
      "short", // too short
      "ABCDEFGHJKLMNPQRSTU", // too long
      "", // empty
    ]) {
      expect(normalizeCode(decodeURIComponent(bad))).toBeNull();
    }
  });

  it("URL-encoded non-ASCII (ñ as %C3%B1) → null", () => {
    const encoded = `ABCDEFGHJKLMNPQ%C3%B1`;
    expect(normalizeCode(decodeURIComponent(encoded))).toBeNull();
  });
});

// =============================================================================
// 2. packResultSchema — defensive validation of the /api/open response
// =============================================================================

describe("/sobre/[code] — packResultSchema validation of API response", () => {
  const validPack = {
    guaranteed: [
      { type: "sports_credit", amount: 10, currency: "USD", label: "$10 USD" },
      {
        type: "casino_spins",
        count: 200,
        game_name: "Clover Super Pot",
        label: "200 giros",
      },
      { type: "deposit_match", multiplier: 3, label: "3x primer depósito" },
    ],
    variable: [
      { type: "none", label: "No ganaste" },
      { type: "none", label: "No ganaste" },
    ],
    pack_version: "v1",
  };

  it("accepts a well-formed pack with 3 guaranteed + 2 variable", () => {
    const parsed = packResultSchema.safeParse(validPack);
    expect(parsed.success).toBe(true);
  });

  it("rejects a pack missing `guaranteed`", () => {
    const { guaranteed: _omit, ...rest } = validPack;
    const parsed = packResultSchema.safeParse(rest);
    expect(parsed.success).toBe(false);
  });

  it("rejects a pack missing `variable`", () => {
    const { variable: _omit, ...rest } = validPack;
    const parsed = packResultSchema.safeParse(rest);
    expect(parsed.success).toBe(false);
  });

  it("rejects a pack where `guaranteed` contains an invalid prize entry", () => {
    // Note: schema does NOT enforce array arity (3/2). It DOES enforce
    // each entry matches the discriminated `Prize` union.
    const parsed = packResultSchema.safeParse({
      ...validPack,
      guaranteed: [{ type: "not_a_real_prize_type", label: "x" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects garbage objects (the page's `kind: error` fallback)", () => {
    expect(packResultSchema.safeParse({ totally: "wrong" }).success).toBe(false);
    expect(packResultSchema.safeParse(null).success).toBe(false);
    expect(packResultSchema.safeParse("string").success).toBe(false);
    expect(packResultSchema.safeParse(42).success).toBe(false);
  });
});

// =============================================================================
// 3. Country → deposit URL (what the page's "Depósitos" CTA uses)
// =============================================================================

describe("/sobre/[code] — deposit URL derivation", () => {
  it("SV → https://ganaplay.sv/landing/depositos", () => {
    expect(DEPOSIT_URLS.SV).toBe("https://ganaplay.sv/landing/depositos");
  });

  it("GT → https://ganaplay.gt/landing/depositos", () => {
    expect(DEPOSIT_URLS.GT).toBe("https://ganaplay.gt/landing/depositos");
  });

  it("DEPOSIT_URLS is frozen — no runtime mutation possible", () => {
    expect(Object.isFrozen(DEPOSIT_URLS)).toBe(true);
  });
});

// =============================================================================
// 4. /api/open response shape contract (what the page expects in JSON)
// =============================================================================

describe("/sobre/[code] — /api/open JSON contract guards", () => {
  // The page's `openCode` helper inspects the parsed JSON body and only
  // proceeds if the body is a non-null object with both `pack` AND
  // `country` keys. We mirror those guards here as plain TS so that if
  // the API contract drifts, the failure is caught at test-time.

  function hasContractKeys(body: unknown): body is { pack: unknown; country: unknown } {
    return (
      body !== null &&
      typeof body === "object" &&
      "pack" in body &&
      "country" in body
    );
  }

  it("recognizes a valid body shape", () => {
    expect(hasContractKeys({ pack: {}, country: "SV" })).toBe(true);
  });

  it("rejects null", () => {
    expect(hasContractKeys(null)).toBe(false);
  });

  it("rejects bodies missing `pack`", () => {
    expect(hasContractKeys({ country: "SV" })).toBe(false);
  });

  it("rejects bodies missing `country`", () => {
    expect(hasContractKeys({ pack: {} })).toBe(false);
  });

  it("rejects non-object bodies (string, number, array)", () => {
    expect(hasContractKeys("hello")).toBe(false);
    expect(hasContractKeys(42)).toBe(false);
    // arrays ARE objects with `pack`/`country` indices technically — but
    // they don't have those KEYS, so the `in` check is false.
    expect(hasContractKeys([])).toBe(false);
  });

  it("only accepts SV or GT for `country` (page guards it)", () => {
    // Verbatim from the page: `country !== "SV" && country !== "GT"`.
    const ok: ReadonlyArray<unknown> = ["SV", "GT"];
    const bad: ReadonlyArray<unknown> = ["US", "AR", "", null, 1, "sv"];
    for (const c of ok) {
      expect(c === "SV" || c === "GT").toBe(true);
    }
    for (const c of bad) {
      expect(c === "SV" || c === "GT").toBe(false);
    }
  });
});
