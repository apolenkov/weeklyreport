import { describe, expect, it } from "vitest";

import {
  buildRuntimeDomainOracle,
  lifecycleExpectation,
  observePeriodDualState,
  observeRuntimeDatabase,
  ownershipExpectation,
  permissionExpectation,
  submissionExpectation,
} from "./state-oracle.ts";

describe("runtime state oracle", () => {
  it("maps lifecycle states to both canonical and legacy fields", () => {
    expect(lifecycleExpectation("open").period).toEqual({
      status: "draft",
      periodState: "open",
      periodStatus: "open",
      archived: false,
    });
    expect(lifecycleExpectation("reopened").period).toEqual({
      status: "published",
      periodState: "open",
      periodStatus: "reopened",
      archived: false,
    });
    expect(lifecycleExpectation("published").editable).toBe(false);
    expect(lifecycleExpectation("archived").period.archived).toBe(true);
  });

  it("maps submission and ownership boundaries without mixing their axes", () => {
    expect(submissionExpectation("rejected")).toMatchObject({
      sectionStatus: "draft",
      submittedAt: "absent",
      verdict: "changes_requested",
      editable: true,
    });
    expect(submissionExpectation("approved")).toMatchObject({
      sectionStatus: "submitted",
      verdict: "approved",
    });
    expect(ownershipExpectation("none").assignedStageCount).toBe(0);
    expect(ownershipExpectation("multiple").hasForeignOwner).toBe(true);
  });

  it("describes authentication and role permission boundaries", () => {
    expect(permissionExpectation("anonymous")).toMatchObject({
      allowed: false,
      authenticated: false,
    });
    expect(permissionExpectation("owner")).toMatchObject({
      allowed: true,
      requiresOwnership: true,
    });
    expect(permissionExpectation("forbidden").allowed).toBe(false);
  });

  it("reports every dual-state mismatch instead of collapsing the tuple", () => {
    const expected = lifecycleExpectation("published").period;
    const actual = { ...expected, periodStatus: "reopened" as const };

    expect(observePeriodDualState(expected, actual)).toEqual({
      matches: false,
      mismatches: ["periodStatus"],
    });
  });

  it("builds a stable key from the four domain axes", () => {
    const oracle = buildRuntimeDomainOracle({
      lifecycle: "reopened",
      submission: "rejected",
      ownership: "multiple",
      permission: "owner",
    });

    expect(oracle.key).toBe("reopened|rejected|multiple|owner");
    expect(Object.isFrozen(oracle)).toBe(true);
  });

  it("checks the period tuple, section verdict, ownership, and permission together", () => {
    const expected = buildRuntimeDomainOracle({
      lifecycle: "reopened",
      submission: "approved",
      ownership: "multiple",
      permission: "owner",
    });
    const observation = observeRuntimeDatabase(expected, {
      report: expected.lifecycle.period,
      section: {
        status: "submitted",
        submittedAt: "present",
        verdict: "approved",
      },
      ownership: {
        targetOwnerId: "lead-owner",
        owners: ["lead-owner", "lead-foreign"],
      },
      permission: {
        actorId: "lead-owner",
        actorRole: "lead",
        authenticated: true,
        allowed: true,
        ownsTarget: true,
      },
    });

    expect(observation).toEqual({ matches: true, mismatches: [] });
  });
});
