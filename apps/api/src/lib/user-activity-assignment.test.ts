import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  AdminGroupProductConflictError,
  AdminUserActivityAssignmentConflictError,
  lockAndAssertGroupHead,
  lockAndValidateProjectOwnership,
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

describe("Head reporting-group membership", () => {
  it.each([
    { role: "head", reportingGroupId: GROUP_A, conflict: false },
    { role: "head", reportingGroupId: GROUP_B, conflict: true },
    { role: "head", reportingGroupId: null, conflict: true },
    { role: "admin", reportingGroupId: GROUP_B, conflict: false },
  ])(
    "checks a $role with group $reportingGroupId against the assigned group",
    async ({ role, reportingGroupId, conflict }) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: USER_ID }]),
        user: {
          findUnique: vi.fn().mockResolvedValue({
            role,
            reportingGroupId,
            isActive: false,
          }),
        },
      } as unknown as Prisma.TransactionClient;
      const assignment = lockAndAssertGroupHead(tx, USER_ID, GROUP_A);
      if (conflict) {
        await expect(assignment).rejects.toBeInstanceOf(
          AdminUserActivityAssignmentConflictError,
        );
      } else {
        await expect(assignment).resolves.toBeUndefined();
      }
    },
  );

  it.each([
    {
      role: "head",
      reportingGroupId: GROUP_A,
      headed: [GROUP_A],
      conflict: false,
    },
    {
      role: "head",
      reportingGroupId: GROUP_B,
      headed: [GROUP_A],
      conflict: true,
    },
    { role: "head", reportingGroupId: null, headed: [GROUP_A], conflict: true },
    {
      role: "head",
      reportingGroupId: GROUP_A,
      headed: [GROUP_A, GROUP_B],
      conflict: true,
    },
    {
      role: "admin",
      reportingGroupId: GROUP_B,
      headed: [GROUP_A, GROUP_B],
      conflict: false,
    },
    { role: "head", reportingGroupId: GROUP_B, headed: [], conflict: false },
  ])(
    "checks every retained heading for desired $role/$reportingGroupId with $headed",
    async ({ role, reportingGroupId, headed, conflict }) => {
      const tx = fakeTx(
        [],
        [],
        headed.map((id) => ({ id })),
      );
      const transfer = lockUserAndAssertActivityAssignments(tx, {
        userId: USER_ID,
        role,
        reportingGroupId,
      });
      if (conflict) {
        await expect(transfer).rejects.toBeInstanceOf(
          AdminUserActivityAssignmentConflictError,
        );
      } else {
        await expect(transfer).resolves.toBe(true);
      }
    },
  );
});

describe("project desired-lead activity admission", () => {
  const DESIRED_LEAD_ID = "66666666-6666-4666-8666-666666666666";
  const inactiveLead = {
    role: "lead",
    reportingGroupId: GROUP_A,
    isActive: false,
  };

  function ownershipTx(currentLeadId: string | null, isActive: boolean) {
    const project =
      currentLeadId === null
        ? null
        : {
            leadId: currentLeadId,
            lead: { role: "lead", reportingGroupId: GROUP_A },
          };
    const projectRead = vi.fn().mockResolvedValue(project);
    const tx = {
      $queryRaw: vi.fn((_query: unknown, id: string) =>
        Promise.resolve([{ id }]),
      ),
      project: { findUnique: projectRead },
      user: {
        findUnique: vi.fn().mockResolvedValue({ ...inactiveLead, isActive }),
      },
      groupProduct: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as Prisma.TransactionClient;
    return { tx, projectRead };
  }

  it.each([
    { name: "an existing product", currentLeadId: USER_ID },
    { name: "a new product", currentLeadId: null },
  ])(
    "refuses a new inactive desired owner for $name",
    async ({ currentLeadId }) => {
      const { tx } = ownershipTx(currentLeadId, false);
      await expect(
        lockAndValidateProjectOwnership(tx, {
          projectId: PROJECT_ID,
          desiredLeadId: DESIRED_LEAD_ID,
        }),
      ).rejects.toBeInstanceOf(AdminGroupProductConflictError);
    },
  );

  it("allows an inactive current owner to remain on a product", async () => {
    const { tx } = ownershipTx(USER_ID, false);
    await expect(
      lockAndValidateProjectOwnership(tx, {
        projectId: PROJECT_ID,
        desiredLeadId: USER_ID,
        expectedGroupId: GROUP_A,
        requireDesiredLeadCurrent: true,
      }),
    ).resolves.toMatchObject({ project: { leadId: USER_ID }, ownership: null });
  });

  it.each([USER_ID, null])(
    "allows an active desired owner when current owner is %s",
    async (currentLeadId) => {
      const { tx } = ownershipTx(currentLeadId, true);
      await expect(
        lockAndValidateProjectOwnership(tx, {
          projectId: PROJECT_ID,
          desiredLeadId: DESIRED_LEAD_ID,
        }),
      ).resolves.toMatchObject({ ownership: null });
    },
  );

  it("preserves concurrent-ownership conflict precedence over inactive desired lead", async () => {
    const { tx, projectRead } = ownershipTx(DESIRED_LEAD_ID, false);
    projectRead.mockResolvedValueOnce({ leadId: USER_ID });
    await expect(
      lockAndValidateProjectOwnership(tx, {
        projectId: PROJECT_ID,
        desiredLeadId: DESIRED_LEAD_ID,
      }),
    ).rejects.toThrow(/changed ownership concurrently/);
  });
});
