-- Album query optimization (perf audit 2026-06-01).
-- The album endpoint runs `WHERE account_id = $1 ORDER BY created_at DESC`.
-- A plain account_id index forces a separate sort; a composite (account_id,
-- created_at DESC) index returns rows presorted in a single index scan. The
-- composite also serves the bare account_id lookup (left-prefix), so the old
-- single-column index is redundant and dropped.

-- DropIndex
DROP INDEX "redemptions_account_id_idx";

-- CreateIndex
CREATE INDEX "redemptions_account_id_created_at_idx" ON "redemptions"("account_id", "created_at" DESC);
