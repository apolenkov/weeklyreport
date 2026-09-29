import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const upgrade = readFileSync(
  new URL(
    "./20260929120000_section_review_comment/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("section review comment additive migration", () => {
  it("adds one nullable column without rewriting existing verdicts", () => {
    expect(upgrade).toContain(
      'ALTER TABLE "SectionReview" ADD COLUMN IF NOT EXISTS "comment" TEXT;',
    );
    expect(upgrade).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(upgrade).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE|DROP)\b/u);
    expect(upgrade).not.toMatch(/\b(?:NOT NULL|DEFAULT)\b/u);
  });
});
