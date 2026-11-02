import { readdirSync, readFileSync } from "node:fs";

import { FEEDBACK_STATUSES, FEEDBACK_TYPES } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20261102020000_product_feedback_value_checks/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

// A later enum change ships as a new forward-only migration that re-adds the
// constraint, so the contract reads the newest definition in the chain, never
// one fixed historical file.
const migrationsInOrder = readdirSync(new URL("./", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory() && /^\d{14}_/u.test(entry.name))
  .map((entry) => entry.name)
  .toSorted()
  .map((name) =>
    readFileSync(new URL(`./${name}/migration.sql`, import.meta.url), "utf8"),
  );

function checkedValues(constraint: string): string[] {
  const pattern = new RegExp(
    String.raw`"${constraint}"\s+CHECK \("\w+" IN \(([^)]*)\)\)`,
    "u",
  );
  const clause = migrationsInOrder
    .map((sql) => pattern.exec(sql))
    .findLast((match) => match?.[1] !== undefined);
  if (clause?.[1] === undefined) return [];
  return [...clause[1].matchAll(/'([^']*)'/gu)].map((match) => match[1] ?? "");
}

describe("product feedback value check migration", () => {
  it("mirrors the shared feedback type enum", () => {
    expect(checkedValues("SitepingFeedback_type_check")).toEqual([
      ...FEEDBACK_TYPES,
    ]);
  });

  it("mirrors the shared feedback status enum", () => {
    expect(checkedValues("SitepingFeedback_status_check")).toEqual([
      ...FEEDBACK_STATUSES,
    ]);
  });

  it("adds constraints in one transaction without rewriting rows", () => {
    expect(migration).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/u);
    expect(migration).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE|DROP)\b/u);
  });
});
