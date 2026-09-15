import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "./20260914120000_item_outcome_promotion/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("item outcome promotion forward migration", () => {
  it("widens the outcome set without rewriting existing rows", () => {
    expect(sql).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(sql).toContain('DROP CONSTRAINT "ItemOutcomeEvent_outcome_check"');
    expect(sql).not.toMatch(
      /\b(?:UPDATE|DELETE|TRUNCATE)\s+"ItemOutcomeEvent"/u,
    );
    expect(sql).not.toMatch(/\bALTER COLUMN\b/u);
  });

  it("keeps every previously accepted outcome and adds promotion", () => {
    for (const outcome of [
      "done",
      "continue",
      "plan_next",
      "wont_do",
      "restore",
      "promote",
    ]) {
      expect(sql).toContain(`'${outcome}'`);
    }
    expect(sql).toMatch(
      /CHECK \("outcome" IN \('done', 'continue', 'plan_next', 'wont_do', 'restore', 'promote'\)\)/u,
    );
  });
});
