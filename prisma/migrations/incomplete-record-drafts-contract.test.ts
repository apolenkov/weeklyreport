import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const migration = read(
  "./20261110090000_incomplete_record_drafts/migration.sql",
);
const schema = read("../schema.prisma");

describe("incomplete record drafts migration", () => {
  it("relaxes only the three detail columns", () => {
    expect(migration).toContain(
      `ALTER TABLE "Risk"\n  ALTER COLUMN "impact" DROP NOT NULL,\n  ALTER COLUMN "mitigation" DROP NOT NULL;`,
    );
    expect(migration).toContain(
      `ALTER TABLE "Decision"\n  ALTER COLUMN "impact" DROP NOT NULL;`,
    );
    expect(migration.match(/DROP NOT NULL/gu)).toHaveLength(3);
  });

  it("is additive: no row rewrite, no dropped column, constraint or index", () => {
    expect(migration).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(migration).not.toMatch(
      /\b(?:UPDATE|DELETE|TRUNCATE|DROP (?:COLUMN|CONSTRAINT|INDEX|TABLE))\b/u,
    );
  });

  it("freezes omission totals as unknown-by-default, never a zero default", () => {
    expect(migration).toContain(`ADD COLUMN "omittedRisks" INTEGER,`);
    expect(migration).toContain(`ADD COLUMN "omittedDecisions" INTEGER;`);
    expect(migration).not.toMatch(/\bDEFAULT\b/u);
    expect(migration).toContain(
      `("omittedRisks" IS NULL AND "omittedDecisions" IS NULL)`,
    );
    expect(migration).toContain(
      `("omittedRisks" >= 0 AND "omittedDecisions" >= 0)`,
    );
  });

  it("keeps the Prisma schema in step with the migration", () => {
    expect(schema).toMatch(
      /\n {2}impact {10}String\?\n {2}mitigation {6}String\?\n/u,
    );
    expect(schema.match(/\n {2}impact {10}String\?\n/gu)).toHaveLength(2);
    expect(schema).toMatch(/omittedRisks\s+Int\?/u);
    expect(schema).toMatch(/omittedDecisions\s+Int\?/u);
    expect(schema).toMatch(/\n {2}risk {12}String\n/u);
    expect(schema).toMatch(/\n {2}severity {8}String\n/u);
  });
});
