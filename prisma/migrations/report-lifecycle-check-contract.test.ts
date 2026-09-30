import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20260930100000_report_lifecycle_check/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("report lifecycle check migration", () => {
  it("adds one transactional CHECK without touching rows", () => {
    expect(migration).toContain(
      'ADD CONSTRAINT "Report_lifecycle_tuple_check"',
    );
    expect(migration).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(migration).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE|DROP)\b/u);
  });
});
