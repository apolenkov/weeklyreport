import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("./20260904214500_item_outcome_audit/migration.sql", import.meta.url),
  "utf8",
);

describe("item outcome audit forward migration", () => {
  it("adds state and audit atomically without rewriting existing item content", () => {
    expect(sql).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(sql).toContain('ADD COLUMN "resolution" JSONB');
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE)\s+"Item"/u);
  });
  it("anchors audit to section and stable identity, never the recreated Item row", () => {
    expect(sql).toContain('"stableId" TEXT NOT NULL');
    expect(sql).toContain('REFERENCES "ReportSection"');
    expect(sql).not.toContain('REFERENCES "Item"');
    expect(sql).toContain('PRIMARY KEY ("id")');
  });
  it("requires cancellation reason and restoration audit reference", () => {
    expect(sql).toContain(
      `"outcome" = 'wont_do' AND "reason" IS NOT NULL AND btrim("reason") <> ''`,
    );
    expect(sql).toContain(
      `("outcome" = 'restore') = ("reversesEventId" IS NOT NULL)`,
    );
    expect(sql).toContain(
      `jsonb_typeof("resolution" -> 'previousState') = 'object'`,
    );
    expect(sql).toContain(`"requestHash" ~ '^[a-f0-9]{64}$'`);
  });
});
