-- Tier de sobre (clasificación visible al usuario antes de abrir).
-- Decisión de producto del 2026-05-28: 4 tiers — bronce / plata / oro / platino.

-- CreateEnum
CREATE TYPE "EnvelopeTier" AS ENUM ('bronce', 'plata', 'oro', 'platino');

-- AlterTable
ALTER TABLE "prize_sets" ADD COLUMN "tier" "EnvelopeTier" NOT NULL DEFAULT 'bronce';

-- CreateIndex
CREATE INDEX "prize_sets_country_tier_idx" ON "prize_sets"("country", "tier");
