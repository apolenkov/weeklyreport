import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  AdminUserActivityAssignmentConflictError,
  lockUser,
  lockUserAndAssertActivityAssignments,
} from "./user-activity-assignment.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVITY_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const GROUP_A = "44444444-4444-4444-8444-444444444444";
const GROUP_B = "55555555-5555-4555-8555-555555555555";

function hasJoin(
  value: unknown,
): value is { join: (separator: string) => string } {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "join" in value &&
    typeof value.join === "function"
  );
}

function hasMockCalls(
  value: unknown,
): value is { mock: { calls: unknown[][] } } {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "mock" in value &&
    typeof value.mock === "object" &&
    value.mock !== null &&
    "calls" in value.mock &&
    Array.isArray(value.mock.calls)
  );
}

function fakeTx(
  edges: unknown[] = [],
  projects: unknown[] = [],
  headed: unknown[] = [],
  users: unknown[] = [{ id: USER_ID }],
): Prisma.TransactionClient {
  return {
    $queryRaw: vi.fn().mockResolvedValue(users),
    projectActivityLead: {
      findMany: vi.fn().mockResolvedValue(edges),
    },
    project: {
      findMany: vi.fn().mockResolvedValue(projects),
    },
    reportingGroup: {
      findMany: vi.fn().mockResolvedValue(headed),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("user assignment integrity", () => {
  it("uses a foreign-key-compatible identity lock", async () => {
    const tx = fakeTx();

    await expect(lockUser(tx, USER_ID)).resolves.toBe(true);
    const queryRaw: unknown = tx.$queryRaw;
    expect(hasMockCalls(queryRaw)).toBe(true);
    if (!hasMockCalls(queryRaw)) return;
    const [query] = queryRaw.mock.calls[0] ?? [];
    expect(hasJoin(query)).toBe(true);
    if (hasJoin(query)) {
      expect(query.join(" ")).toContain("FOR NO KEY UPDATE");
    }
  });

  it("rejects a role change for an attached activity", async () => {
    const tx = fakeTx([
      { activityId: ACTIVITY_ID, activity: { groupId: GROUP_A } },
    ]);

    await expect(
      lockUserAndAssertActivityAssignments(tx, {
        userId: USER_ID,
        role: "viewer",
        reportingGroupId: GROUP_A,
      }),
    ).rejects.toBeInstanceOf(AdminUserActivityAssignmentConflictError);
  });

  it("rejects a group change for an attached activity", async () => {
    const tx = fakeTx([
      { activityId: ACTIVITY_ID, activity: { groupId: GROUP_A } },
    ]);

    await expect(
      lockUserAndAssertActivityAssignments(tx, {
        userId: USER_ID,
        role: "lead",
        reportingGroupId: GROUP_B,
      }),
    ).rejects.toBeInstanceOf(AdminUserActivityAssignmentConflictError);
  });

  it("rejects a role change for an owned project", async () => {
    const tx = fakeTx(
      [],
      [{ id: PROJECT_ID, groupProducts: [{ groupId: GROUP_A }] }],
    );

    await expect(
      lockUserAndAssertActivityAssignments(tx, {
        userId: USER_ID,
        role: "viewer",
        reportingGroupId: GROUP_A,
      }),
    ).rejects.toBeInstanceOf(AdminUserActivityAssignmentConflictError);
  });

  it("rejects demoting a reporting-group head to a non-head role", async () => {
    const tx = fakeTx([], [], [{ id: GROUP_A }]);

    await expect(
      lockUserAndAssertActivityAssignments(tx, {
        userId: USER_ID,
        role: "lead",
        reportingGroupId: GROUP_A,
      }),
    ).rejects.toBeInstanceOf(AdminUserActivityAssignmentConflictError);
  });

  it("returns false without reading the graph when the user is missing", async () => {
    const tx = fakeTx([], [], [], []);

    await expect(
      lockUserAndAssertActivityAssignments(tx, {
        userId: USER_ID,
        role: "lead",
        reportingGroupId: GROUP_A,
      }),
    ).resolves.toBe(false);
    expect(tx.projectActivityLead.findMany).not.toHaveBeenCalled();
    expect(tx.project.findMany).not.toHaveBeenCalled();
    expect(tx.reportingGroup.findMany).not.toHaveBeenCalled();
  });

  it("allows a compatible lead assignment", async () => {
    const tx = fakeTx(
      [{ activityId: ACTIVITY_ID, activity: { groupId: GROUP_A } }],
      [{ id: PROJECT_ID, groupProducts: [{ groupId: GROUP_A }] }],
    );

    await expect(
      lockUserAndAssertActivityAssignments(tx, {
        userId: USER_ID,
        role: "lead",
        reportingGroupId: GROUP_A,
      }),
    ).resolves.toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
