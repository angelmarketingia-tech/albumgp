-- CreateEnum
CREATE TYPE "Country" AS ENUM ('SV', 'GT');

-- CreateEnum
CREATE TYPE "CodeStatus" AS ENUM ('active', 'redeemed', 'disabled', 'expired');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('pending', 'sent', 'confirmed', 'failed');

-- CreateTable
CREATE TABLE "codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "prize_set_id" UUID NOT NULL,
    "status" "CodeStatus" NOT NULL DEFAULT 'active',
    "pack_result" JSONB,
    "opened_at" TIMESTAMP(3),
    "redeemed_at" TIMESTAMP(3),
    "redeemed_by" TEXT,
    "redeemed_ip" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prize_sets" (
    "id" UUID NOT NULL,
    "country" "Country" NOT NULL,
    "guaranteed" JSONB NOT NULL,
    "variable_pool" JSONB NOT NULL,
    "cards_per_pack" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prize_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" UUID NOT NULL,
    "code_id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "webhook_status" "WebhookStatus" NOT NULL DEFAULT 'pending',
    "webhook_attempts" INTEGER NOT NULL DEFAULT 0,
    "webhook_last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "codes_code_key" ON "codes"("code");

-- CreateIndex
CREATE INDEX "codes_status_idx" ON "codes"("status");

-- CreateIndex
CREATE INDEX "codes_country_idx" ON "codes"("country");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_code_id_key" ON "redemptions"("code_id");

-- CreateIndex
CREATE INDEX "redemptions_account_id_idx" ON "redemptions"("account_id");

-- CreateIndex
CREATE INDEX "redemptions_webhook_status_idx" ON "redemptions"("webhook_status");

-- AddForeignKey
ALTER TABLE "codes" ADD CONSTRAINT "codes_prize_set_id_fkey" FOREIGN KEY ("prize_set_id") REFERENCES "prize_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
