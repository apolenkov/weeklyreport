import { describe, expect, it } from "vitest";

import {
  decideInitMigrationAction,
  parseMigrationTargetEnvironment,
} from "./check-init-migration-target.js";

describe("check-init-migration-target", () => {
  it("permits edited init application for an uninitialized target", () => {
    expect(decideInitMigrationAction("production", "uninitialized")).toEqual({
      action: "apply_edited_init",
      reason: "The target has no init migration ledger entry.",
    });
  });

  it("stops production after the edited init is already recorded", () => {
    expect(decideInitMigrationAction("production", "applied")).toMatchObject({
      action: "stop_for_additive_migration",
    });
  });

  it("requires ledger review for incomplete migrations", () => {
    expect(decideInitMigrationAction("test", "incomplete")).toMatchObject({
      action: "stop_for_ledger_review",
    });
  });

  it("accepts only explicit deployment target environments", () => {
    expect(parseMigrationTargetEnvironment("uat")).toBe("uat");
    expect(() => parseMigrationTargetEnvironment("local")).toThrow(
      "MIGRATION_TARGET_ENV must be one of",
    );
  });
});
