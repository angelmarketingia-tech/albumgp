// Prisma singleton. Avoids exhausting the connection pool in `next dev`'s
// hot-reload, which would otherwise create a new PrismaClient on every
// module reload.
//
// DEV-ONLY: when `DEV_MOCK_DB=1` is set in `.env.local`, returns an
// in-memory mock that satisfies the same surface used by the app. Hard-
// fails if invoked under `NODE_ENV=production` to prevent accidents.

import { PrismaClient } from "@prisma/client";
import { createDevMockPrisma } from "./dev-mock";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildPrisma(): PrismaClient {
  if (
    process.env.DEV_MOCK_DB === "1" &&
    process.env.NODE_ENV !== "production"
  ) {
    return createDevMockPrisma();
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? buildPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
