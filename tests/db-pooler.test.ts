import { describe, it, expect } from "vitest";
import { assertPooledUrlInProd } from "../lib/db/client";

const PROD = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

describe("assertPooledUrlInProd", () => {
  it("returns the url unchanged outside production", () => {
    const url = "postgresql://u:p@direct.host/db";
    expect(assertPooledUrlInProd(url, { NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(url);
  });

  it("throws in production when DATABASE_URL is missing", () => {
    expect(() => assertPooledUrlInProd(undefined, PROD)).toThrow(/DATABASE_URL/);
  });

  it("throws in production on a direct (non-pooled) url", () => {
    expect(() =>
      assertPooledUrlInProd("postgresql://u:p@ep-xxx.us-east-1.aws.neon.tech/db", PROD),
    ).toThrow(/pooler/i);
  });

  it("accepts a Neon -pooler host and injects safe defaults", () => {
    const out = assertPooledUrlInProd(
      "postgresql://u:p@ep-xxx-pooler.us-east-1.aws.neon.tech/db?sslmode=require",
      PROD,
    );
    expect(out).toContain("-pooler");
    expect(out).toContain("connection_limit=1");
    expect(out).toContain("pool_timeout=10");
  });

  it("accepts a url that explicitly sets pgbouncer=true even without -pooler host", () => {
    const out = assertPooledUrlInProd(
      "postgresql://u:p@some.host/db?pgbouncer=true",
      PROD,
    );
    expect(out).toContain("pgbouncer=true");
    expect(out).toContain("connection_limit=1");
  });

  it("preserves an explicit connection_limit instead of overriding it", () => {
    const out = assertPooledUrlInProd(
      "postgresql://u:p@ep-xxx-pooler.host/db?connection_limit=5",
      PROD,
    );
    expect(out).toContain("connection_limit=5");
    expect(out).not.toContain("connection_limit=1");
  });

  it("allows opt-out via DB_POOLER_OK=1 for non-Neon poolers", () => {
    const out = assertPooledUrlInProd("postgresql://u:p@my.pgbouncer.internal/db", {
      NODE_ENV: "production",
      DB_POOLER_OK: "1",
    } as NodeJS.ProcessEnv);
    expect(out).toContain("connection_limit=1");
  });

  it("throws on an unparseable url in production", () => {
    expect(() => assertPooledUrlInProd("not a url", PROD)).toThrow(/válida/);
  });
});
