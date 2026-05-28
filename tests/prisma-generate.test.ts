// Schema-shape test. We avoid running `prisma generate` inside the test
// runner because:
//   1. It performs a network download of the query engine on first run,
//      which is flaky and slow in CI.
//   2. Whether the generated client imports cleanly is already validated
//      transitively by `tsc --noEmit` (which imports `@prisma/client`).
//
// Instead, we parse `prisma/schema.prisma` textually and assert the
// load-bearing pieces of the data model the rest of the codebase depends on.
// Anyone who later wants the full generate check can run `npm run db:generate`.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const schemaPath = resolve(__dirname, "..", "prisma", "schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

describe("prisma/schema.prisma", () => {
  it("targets postgresql with pooled + direct URLs", () => {
    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
    expect(schema).toMatch(/directUrl\s*=\s*env\("DIRECT_DATABASE_URL"\)/);
  });

  it("declares the three required models", () => {
    expect(schema).toMatch(/model\s+Code\s*\{/);
    expect(schema).toMatch(/model\s+PrizeSet\s*\{/);
    expect(schema).toMatch(/model\s+Redemption\s*\{/);
  });

  it("declares Country, CodeStatus and WebhookStatus enums", () => {
    expect(schema).toMatch(/enum\s+Country\s*\{[\s\S]*\bSV\b[\s\S]*\bGT\b/);
    expect(schema).toMatch(
      /enum\s+CodeStatus\s*\{[\s\S]*active[\s\S]*redeemed[\s\S]*disabled[\s\S]*expired/,
    );
    expect(schema).toMatch(
      /enum\s+WebhookStatus\s*\{[\s\S]*pending[\s\S]*sent[\s\S]*confirmed[\s\S]*failed/,
    );
  });

  it("Code has a unique code column and required indexes", () => {
    expect(schema).toMatch(/code\s+String\s+@unique/);
    expect(schema).toMatch(/@@index\(\[status\]\)/);
    expect(schema).toMatch(/@@index\(\[country\]\)/);
  });

  it("Redemption.codeId is unique (one redemption per code)", () => {
    expect(schema).toMatch(/codeId\s+String\s+@unique/);
  });

  it("Redemption carries webhook tracking fields", () => {
    expect(schema).toMatch(/webhookStatus\s+WebhookStatus/);
    expect(schema).toMatch(/webhookAttempts\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(/webhookLastError\s+String\?/);
  });

  it("PrizeSet stores guaranteed + variable_pool as Json with cards_per_pack default 5", () => {
    expect(schema).toMatch(/guaranteed\s+Json/);
    expect(schema).toMatch(/variablePool\s+Json/);
    expect(schema).toMatch(/cardsPerPack\s+Int\s+@default\(5\)/);
  });
});
