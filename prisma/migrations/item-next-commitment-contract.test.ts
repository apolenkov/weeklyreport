import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20260904203000_item_next_commitment/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const initMigration = readFileSync(
  new URL("./20260530162224_init/migration.sql", import.meta.url),
  "utf8",
);
const statusUpgradeUrl = new URL(
  "./20260914223000_item_week_status_independence/migration.sql",
  import.meta.url,
);

describe("item week-status migration history", () => {
  it("adds nullable commitment text without rewriting existing results", () => {
    expect(migration).toContain('ADD COLUMN "nextStepText" TEXT');
    expect(migration).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE)\b/u);
    expect(migration).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
  });

  it("keeps the already-deployed next-commitment migration historical", () => {
    expect(migration).toContain(
      `("type" = 'current' AND "workflowStatus" IN ('planned', 'in_progress', 'paused', 'done'))`,
    );
    expect(migration).toContain(
      `("type" = 'next' AND "workflowStatus" IN ('planned', 'postponed'))`,
    );
  });

  it("upgrades existing databases after the historical migrations", () => {
    expect(existsSync(statusUpgradeUrl)).toBe(true);
    if (!existsSync(statusUpgradeUrl)) return;
    const statusUpgrade = readFileSync(statusUpgradeUrl, "utf8");

    for (const sql of [initMigration, statusUpgrade]) {
      expect(sql).toContain(
        `("type" = 'current' AND "workflowStatus" IN ('planned', 'in_progress', 'paused', 'postponed', 'done'))`,
      );
      expect(sql).toContain(
        `("type" = 'next' AND "workflowStatus" IN ('planned', 'in_progress', 'paused', 'postponed', 'done'))`,
      );
    }
    expect(statusUpgrade).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(statusUpgrade).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE)\b/u);
  });

  it("limits nonblank commitments to unfinished current work", () => {
    expect(migration).toContain('CONSTRAINT "Item_next_step_check"');
    expect(migration).toContain(
      `"type" = 'current' AND "workflowStatus" <> 'done'`,
    );
    expect(migration).toContain(`btrim("nextStepText") <> ''`);
  });
});
