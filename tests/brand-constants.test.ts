import { describe, it, expect } from "vitest";
import {
  GANAPLAY_SLOGAN,
  DEPOSIT_URLS,
  SIGNIN_URLS,
  LEGAL_NOTICES,
  BRAND_NAME,
} from "../lib/brand/constants";

describe("brand constants — Manual de Marca", () => {
  it("exports the official slogan exactly as in the Manual", () => {
    expect(GANAPLAY_SLOGAN).toBe("Ganar es una pasión");
  });

  it("uses canonical brand name capitalization", () => {
    expect(BRAND_NAME).toBe("GanaPlay");
  });

  it("DEPOSIT_URLS covers both countries with official URLs", () => {
    expect(DEPOSIT_URLS.SV).toBe("https://ganaplay.sv/landing/depositos");
    expect(DEPOSIT_URLS.GT).toBe("https://ganaplay.gt/landing/depositos");
  });

  it("DEPOSIT_URLS is frozen", () => {
    expect(Object.isFrozen(DEPOSIT_URLS)).toBe(true);
  });

  it("SIGNIN_URLS covers both countries with official GanaPlay login", () => {
    expect(SIGNIN_URLS.SV).toBe("https://ganaplay.sv/iniciar-sesion");
    expect(SIGNIN_URLS.GT).toBe("https://ganaplay.gt/iniciar-sesion");
  });

  it("SIGNIN_URLS is frozen", () => {
    expect(Object.isFrozen(SIGNIN_URLS)).toBe(true);
  });

  it("LEGAL_NOTICES includes age gate and responsible gaming", () => {
    expect(LEGAL_NOTICES.ageGate).toBe("Solo mayores de 18 años");
    expect(LEGAL_NOTICES.responsibleGaming).toBe("Juega responsablemente");
  });

  it("LEGAL_NOTICES is frozen", () => {
    expect(Object.isFrozen(LEGAL_NOTICES)).toBe(true);
  });
});
