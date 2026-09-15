import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("./20260530162224_init/migration.sql", import.meta.url),
  "utf8",
);
const upgradeUrl = new URL(
  "./20260915100000_activity_title_override/migration.sql",
  import.meta.url,
);

describe("activity title override canonical migration", () => {
  it("declares exactly one nullable column on the canonical ActivityStatus table", () => {
    const table = /CREATE TABLE "ActivityStatus" \([\s\S]*?\n\);/u.exec(
      sql,
    )?.[0];
    expect(table).toBeDefined();
    expect(table).toContain('"titleOverride" TEXT');
    expect(table).not.toMatch(/"titleOverride" TEXT NOT NULL/u);
  });

  it("keeps fresh installs and existing databases schema-synchronized", () => {
    expect(existsSync(upgradeUrl)).toBe(true);
    if (!existsSync(upgradeUrl)) return;
    const upgrade = readFileSync(upgradeUrl, "utf8");

    expect(upgrade).toContain(
      'ALTER TABLE "ActivityStatus" ADD COLUMN IF NOT EXISTS "titleOverride" TEXT;',
    );
    expect(upgrade).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(upgrade).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE|DROP)\b/u);
    expect(upgrade).not.toMatch(/\b(?:NOT NULL|DEFAULT)\b/u);
  });
});
