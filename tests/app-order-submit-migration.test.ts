import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../prisma/migrations/20260730000100_app_order_submitter_wechat_qr/migration.sql", import.meta.url), "utf8");

describe("APP order submitter migration", () => {
  it("backfills every known customer submitter", () => {
    expect(migration).toMatch(/SET "appSubmitterId" = "customerId"\s+WHERE "customerId" IS NOT NULL/);
  });

  it("backfills employees only with a matching ORDER_SUBMIT event", () => {
    expect(migration).toContain('SET "appSubmitterId" = o."sourceEmployeeId"');
    expect(migration).toContain('o."sourceEmployeeId" IS NOT NULL');
    expect(migration).toContain('e."sessionId" = o."idempotencyKey"');
    expect(migration).toContain("e.\"type\" = 'ORDER_SUBMIT'");
  });

  it("does not guess an old store-admin submitter", () => {
    expect(migration).not.toMatch(/SET "appSubmitterId" = (?:o\.)?"responsibleEmployeeId"/);
    expect(migration).not.toMatch(/role[^\n]*STORE_ADMIN/i);
  });
});
