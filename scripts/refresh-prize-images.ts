// Re-resuelve los packs congelados para que tomen las rutas de imagen nuevas.
//
// CONTEXTO
// --------
// Las cartas garantizadas guardan su `image_url` dentro del JSON `guaranteed`
// del `prize_set`, y ese JSON se copia/resuelve al `pack_result` de cada código
// en su PRIMERA apertura (AGENTS.md §3 / §11: el pack se fija al abrir). Si el
// seed se corrió con rutas viejas (.webp inexistentes), los packs ya abiertos
// quedaron congelados apuntando a imágenes que dan 404.
//
// Este script, tras re-sembrar (`npm run db:seed`), limpia el pack congelado de
// los códigos ABIERTOS PERO NO CANJEADOS para que se re-resuelvan con las rutas
// nuevas en la próxima apertura. Es deliberadamente conservador:
//
//   - NO toca códigos canjeados (`redeemedAt != null`): el premio ya se entregó,
//     resetearlo cambiaría las cartas que el usuario vio. Intocable.
//   - NO toca códigos nunca abiertos (`packResult == null`): ya tomarán las
//     rutas nuevas al abrirse, no hay nada que limpiar.
//   - Sí limpia `packResult` + `openedAt` de los abiertos-sin-canjear. Efecto:
//     al re-abrir, las cartas VARIABLES pueden salir distintas (se re-tiran).
//     Las garantizadas son fijas, así que el cambio visible es básicamente
//     "ahora cargan las imágenes". Aceptado en la decisión del operador.
//
// USO
// ---
//   1) Re-sembrar primero:   npm run db:seed
//   2) Refrescar packs:      npx tsx scripts/refresh-prize-images.ts
//
// Variables de entorno: usa la misma DATABASE_URL que la app (apuntala a prod
// con cuidado). Dry-run por defecto; pasá --apply para escribir.

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  // Abiertos (tienen pack congelado) pero NO canjeados.
  const candidates = await prisma.code.findMany({
    where: {
      NOT: { packResult: { equals: Prisma.DbNull } },
      redeemedAt: null,
    },
    select: { id: true, code: true, country: true, openedAt: true },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Códigos abiertos-sin-canjear con pack congelado: ${candidates.length}`,
  );

  // Cuántos canjeados quedan intactos (informativo).
  const redeemed = await prisma.code.count({
    where: {
      NOT: { packResult: { equals: Prisma.DbNull } },
      redeemedAt: { not: null },
    },
  });
  // eslint-disable-next-line no-console
  console.log(`Canjeados intactos (no se tocan): ${redeemed}`);

  if (!APPLY) {
    // eslint-disable-next-line no-console
    console.log(
      "\nDRY-RUN. Nada escrito. Re-corré con --apply para limpiar los packs:\n" +
        "  npx tsx scripts/refresh-prize-images.ts --apply",
    );
    return;
  }

  // Json no se puede setear a NULL con Prisma `updateMany` (espera JsonNull/DbNull
  // de forma especial); usamos SQL crudo para forzar pack_result = NULL.
  const cleared = await prisma.$executeRaw`
    UPDATE "codes"
    SET "pack_result" = NULL, "opened_at" = NULL
    WHERE "pack_result" IS NOT NULL AND "redeemed_at" IS NULL
  `;

  // eslint-disable-next-line no-console
  console.log(
    `\nListo. Packs limpiados: ${cleared}. ` +
      "Al re-abrir, los sobres tomarán las imágenes nuevas.",
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
