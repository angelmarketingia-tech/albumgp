import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "..");

function abs(rel: string): string {
  return resolve(repoRoot, rel);
}

describe("brand assets — fuentes de verdad en /brand", () => {
  const sources = [
    "brand/logo/logo-blanco.png",
    "brand/logo/logo-principal.jpg",
    "brand/logo/logo-solo-isotipo.jpg",
    "brand/plantilla-fondo-historias.png",
    "brand/README.md",
  ];

  it.each(sources)("existe en disco: %s", (rel) => {
    const p = abs(rel);
    expect(existsSync(p), `falta el asset esperado: ${rel}`).toBe(true);
    expect(statSync(p).size).toBeGreaterThan(0);
  });
});

describe("brand assets — copias servidas en /public/brand", () => {
  // Next.js solo sirve /public. Las copias deben existir y no estar vacias.
  const served = [
    "public/brand/logo/logo-blanco.png",
    "public/brand/logo/logo-principal.jpg",
    "public/brand/logo/logo-solo-isotipo.jpg",
  ];

  it.each(served)("existe en disco: %s", (rel) => {
    const p = abs(rel);
    expect(existsSync(p), `falta la copia servible: ${rel}`).toBe(true);
    expect(statSync(p).size).toBeGreaterThan(0);
  });
});

describe("brand assets — referencias y documentacion", () => {
  it("existe la referencia visual del sobre", () => {
    expect(
      existsSync(abs("public/assets/referencias/sobre-direccion-visual.png")),
    ).toBe(true);
  });

  it("existe public/assets/README.md", () => {
    expect(existsSync(abs("public/assets/README.md"))).toBe(true);
  });
});

describe("brand assets — Manual de Marca", () => {
  // El PDF pesa 131 MB y vive solo en disco local (.gitignore). El test
  // no exige que exista en CI; solo verifica que SI esta presente, no este
  // truncado a cero bytes.
  it("si el Manual esta presente, no esta vacio", () => {
    const p = abs("brand/MANUAL_DE_MARCA.pdf");
    if (!existsSync(p)) {
      // Pendiente del dueno: ver brand/README.md.
      return;
    }
    expect(statSync(p).size).toBeGreaterThan(0);
  });
});

describe("componente Logo", () => {
  // TODO: cuando se instale @testing-library/react + jsdom, anadir un
  // snapshot real renderizando <Logo /> y verificando que el src apunta a
  // /brand/logo/logo-blanco.png. Por ahora chequeamos que el modulo
  // exista y referencie las tres variantes esperadas, sin importarlo
  // (importar JSX/next-image en entorno node requiere setup adicional).
  it("el archivo Logo.tsx existe y declara las tres variantes", async () => {
    const p = abs("components/brand/Logo.tsx");
    expect(existsSync(p)).toBe(true);
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("logo-blanco.png");
    expect(src).toContain("logo-principal.jpg");
    expect(src).toContain("logo-solo-isotipo.jpg");
    expect(src).toContain("export type LogoVariant");
  });
});
