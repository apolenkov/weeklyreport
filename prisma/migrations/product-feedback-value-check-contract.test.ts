import { readFileSync } from "node:fs";

import { FEEDBACK_STATUSES, FEEDBACK_TYPES } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20261102020000_product_feedback_value_checks/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

function checkedValues(constraint: string): string[] {
  const clause = new RegExp(
    String.raw`"${constraint}"\s+CHECK \("\w+" IN \(([^)]*)\)\)`,
    "u",
  ).exec(migration);
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
