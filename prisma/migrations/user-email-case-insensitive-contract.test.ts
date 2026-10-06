import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20261007003500_user_email_case_insensitive/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("user email case-insensitive migration", () => {
  it("refuses ambiguous case-only duplicates before indexing", () => {
    expect(migration).toContain('GROUP BY lower("email")');
    expect(migration).toContain("HAVING count(*) > 1");
    expect(migration).toContain("RAISE EXCEPTION");
    expect(migration.indexOf("DO $$")).toBeLessThan(
      migration.indexOf('CREATE UNIQUE INDEX "User_email_lower_key"'),
    );
  });

  it("adds one transactional unique lower(email) index without touching rows", () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"))',
    );
    expect(migration).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(migration).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/u);
  });
});
