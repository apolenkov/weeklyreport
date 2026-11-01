import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { AdminUserActivityAssignmentConflictError } from "../../lib/user-activity-assignment.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "./admin.prisma-repository";

// Head/group pointer consistency at the repository boundary. The group's
// headUserId may only point at a head or admin user, and a head user may only
// head the group they belong to. These tests pin the boundary checks (restore
// and targeted writes) and the lock serialization that keeps assignment and
// demotion from interleaving into an inconsistent final state.
describe("admin Head/group consistency (integration)", () => {
  const otherGroupId = "a0000000-0000-4000-a000-000000000080";
  const newGroupId = "a0000000-0000-4000-a000-000000000083";
  const newHeadId = "a0000000-0000-4000-a000-000000000084";
  const viewerId = "a0000000-0000-4000-a000-000000000085";

  const prisma = createTestPrisma();
  const repo = new AdminPrismaRepository(prisma as never);
  // Re-seeded per test after cleanDatabase, so the binding has to be mutable.
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  async function headFixture() {
    await prisma.reportingGroup.create({
      data: { id: otherGroupId, name: "Other reporting group" },
    });
    const snapshot = await repo.getSnapshot();
    return {
      head: expectDefined(
        snapshot.users.find(({ id }) => id === testData.head.id),
      ),
      ownGroup: expectDefined(
        snapshot.groups.find(({ id }) => id === TEST_IDS.group),
      ),
      otherGroup: expectDefined(
        snapshot.groups.find(({ id }) => id === otherGroupId),
      ),
    };
  }

  async function lockWaiterCount(): Promise<number> {
    const [row] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
    `;
    return expectDefined(row).count;
  }

  async function waitForLockWaiters(min: number): Promise<void> {
    await vi.waitFor(
      async () => {
        expect(await lockWaiterCount()).toBeGreaterThanOrEqual(min);
      },
      { timeout: 3000, interval: 20 },
    );
  }

  it("restores a brand-new reporting group with its head user in one snapshot", async () => {
    const { head } = await headFixture();
    const before = await repo.getSnapshot();
    await repo.saveSnapshot({
      ...before,
      users: [
        ...before.users,
        {
          ...head,
          id: newHeadId,
          email: "new-group-head@test.local",
          reportingGroupId: newGroupId,
          reportingGroupName: "New reporting group",
        },
      ],
      groups: [
        ...before.groups,
        {
          id: newGroupId,
          name: "New reporting group",
          description: null,
          archived: false,
          headUserId: newHeadId,
        },
      ],
    });

    await expect(
      prisma.reportingGroup.findUnique({ where: { id: newGroupId } }),
    ).resolves.toMatchObject({ headUserId: newHeadId });
    const restored = await repo.getSnapshot();
    expect(
      expectDefined(restored.users.find(({ id }) => id === newHeadId)),
    ).toMatchObject({ role: "head", reportingGroupId: newGroupId });
    expect(
      expectDefined(restored.groups.find(({ id }) => id === newGroupId)),
    ).toMatchObject({ headUserId: newHeadId });
  });

  it.each(["lead", "viewer"] as const)(
    "rejects a %s as a reporting-group head without changing the group",
    async (role) => {
      const { otherGroup } = await headFixture();
      const user =
        role === "lead"
          ? testData.lead
          : await prisma.user.create({
              data: {
                id: viewerId,
                email: "viewer@test.local",
                samlId: "viewer-test",
                name: "Test Viewer",
                lastName: "Test",
                firstName: "Viewer",
                role: "viewer",
                reportingGroupId: null,
              },
            });

      await expect(
        repo.saveReportingGroup({ ...otherGroup, headUserId: user.id }),
      ).rejects.toBeInstanceOf(AdminUserActivityAssignmentConflictError);
      await expect(
        prisma.reportingGroup.findUnique({ where: { id: otherGroupId } }),
      ).resolves.toMatchObject({
        name: "Other reporting group",
        headUserId: null,
      });
    },
  );

  it.each(["lead as head", "head of a foreign group"] as const)(
    "rejects a snapshot pointing %s at a group before any write",
    async (caseName) => {
      const { head, ownGroup, otherGroup } = await headFixture();
      const before = await repo.getSnapshot();
      const headId = caseName === "lead as head" ? testData.lead.id : head.id;
      const targetGroupId =
        caseName === "lead as head" ? ownGroup.id : otherGroup.id;
      const groups = before.groups.map((group) =>
        group.id === targetGroupId ? { ...group, headUserId: headId } : group,
      );
      const expectedIssue =
        caseName === "lead as head"
          ? "must reference a head or admin user"
          : "must belong to that reporting group";

      // A raw ZodError proves the rejection happens at the restore input
      // parse, before the transaction opens and any row is written.
      const failing = repo.saveSnapshot({ ...before, groups });
      await expect(failing).rejects.toBeInstanceOf(ZodError);
      await expect(failing).rejects.toThrow(expectedIssue);
      await expect(repo.getSnapshot()).resolves.toEqual(before);
    },
  );

  it.each(["assignment first", "demotion first"] as const)(
    "serializes %s so the loser gets an assignment conflict",
    async (order) => {
      const { head, ownGroup } = await headFixture();
      // Hold the head's User row lock (the same FOR NO KEY UPDATE both
      // writers take) so both writers queue behind it and commit in a
      // deterministic order once it is released.
      const locked = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT "id" FROM "User" WHERE "id" = ${head.id} FOR NO KEY UPDATE
          `;
          locked.resolve();
          await release.promise;
        },
        { timeout: 15_000 },
      );
      await locked.promise;

      const assign = () =>
        repo.saveReportingGroup({ ...ownGroup, headUserId: head.id });
      const demote = () => repo.upsertUser({ ...head, role: "lead" });
      const [firstOp, secondOp] =
        order === "assignment first" ? [assign, demote] : [demote, assign];

      try {
        const first = firstOp();
        await waitForLockWaiters(1);
        const second = secondOp();
        await waitForLockWaiters(2);
        release.resolve();
        const [firstOutcome, secondOutcome] = await Promise.allSettled([
          first,
          second,
        ]);
        expect(firstOutcome.status).toBe("fulfilled");
        expect(secondOutcome.status).toBe("rejected");
        if (secondOutcome.status === "rejected") {
          expect(secondOutcome.reason).toBeInstanceOf(
            AdminUserActivityAssignmentConflictError,
          );
        }
      } finally {
        release.resolve();
        await Promise.allSettled([holder]);
      }

      // The pointer never lands on a non-head/admin user, whatever order the
      // writers took.
      if (order === "assignment first") {
        await expect(
          prisma.user.findUnique({ where: { id: head.id } }),
        ).resolves.toMatchObject({ role: "head" });
        await expect(
          prisma.reportingGroup.findUnique({ where: { id: TEST_IDS.group } }),
        ).resolves.toMatchObject({ headUserId: head.id });
      } else {
        await expect(
          prisma.user.findUnique({ where: { id: head.id } }),
        ).resolves.toMatchObject({ role: "lead" });
        await expect(
          prisma.reportingGroup.findUnique({ where: { id: TEST_IDS.group } }),
        ).resolves.toMatchObject({ headUserId: null });
      }
    },
  );
});
