import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20260904203000_item_next_commitment/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("next commitment forward migration", () => {
  it("adds nullable commitment text without rewriting existing results", () => {
    expect(migration).toContain('ADD COLUMN "nextStepText" TEXT');
    expect(migration).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE)\b/u);
    expect(migration).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
  });

  it("allows not-started current work without changing next-only postponement", () => {
    expect(migration).toContain(
      `("type" = 'current' AND "workflowStatus" IN ('planned', 'in_progress', 'paused', 'done'))`,
    );
    expect(migration).toContain(
      `("type" = 'next' AND "workflowStatus" IN ('planned', 'postponed'))`,
    );
  });

  it("limits nonblank commitments to unfinished current work", () => {
    expect(migration).toContain('CONSTRAINT "Item_next_step_check"');
    expect(migration).toContain(
      `"type" = 'current' AND "workflowStatus" <> 'done'`,
    );
    expect(migration).toContain(`btrim("nextStepText") <> ''`);
  });
});
