// Genera los assets source para @capacitor/assets (iconos + splash nativos)
// desde el isotipo blanco de marca sobre el verde GanaPlay. Usa sharp (viene con
// @capacitor/assets). Salida en assets/ — luego `npx capacitor-assets generate`.
//
// PLACEHOLDER de marca: arte brand-correcto pero programático. El dueño puede
// reemplazar assets/icon-only.png y assets/splash.png con arte final 1:1 y
// re-correr la generación, sin tocar nada más.

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const OUT = path.join(ROOT, "assets");
fs.mkdirSync(OUT, { recursive: true });

const GREEN_CORE = "#00783E";
const GREEN_DEEP = "#034419";
const GOLD = "#D4A017";

const isotipo = fs.readFileSync(
  path.join(ROOT, "public/brand/logo/isotipo-white.svg"),
);

// Fondo radial de marca como SVG (sharp rasteriza SVG).
function bgSvg(size) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stop-color="${GREEN_CORE}"/>
          <stop offset="100%" stop-color="${GREEN_DEEP}"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#g)"/>
    </svg>`);
}

// Compone: fondo radial + isotipo centrado a `markRatio` del lienzo.
async function compose(size, markRatio, outFile, opts = {}) {
  const mark = Math.round(size * markRatio);
  const markPng = await sharp(isotipo, { density: 400 })
    .resize(mark, mark, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const bg = opts.transparent
    ? sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    : sharp(bgSvg(size));
  await bg
    .composite([{ input: markPng, gravity: "center" }])
    .png()
    .toFile(path.join(OUT, outFile));
  console.log("✓", outFile, `${size}x${size}`);
}

await Promise.all([
  // Icono principal (con fondo) — Apple + fallback Android.
  compose(1024, 0.6, "icon-only.png"),
  // Foreground para adaptive icon Android (transparente, mark en safe-zone ~62%).
  compose(1024, 0.62, "icon-foreground.png", { transparent: true }),
  // Background sólido para adaptive icon.
  sharp(bgSvg(1024)).png().toFile(path.join(OUT, "icon-background.png")).then(() =>
    console.log("✓ icon-background.png 1024x1024"),
  ),
  // Splash (centrado, mark más chico para respiración).
  compose(2732, 0.28, "splash.png"),
  // Splash dark (mismo, GanaPlay no tiene tema claro).
  compose(2732, 0.28, "splash-dark.png"),
]);

console.log("\nGold accent reservado para arte final:", GOLD);
console.log("Listo. Ahora: npx capacitor-assets generate --android");
