import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import {
  ProjectActivityConflictError,
  ProjectActivityDomainError,
} from "./project-activity.errors";
import { ProjectActivityPrismaRepository } from "./project-activity.prisma-repository";

const GROUP_A = "c0000000-0000-4000-a000-000000000001";
const GROUP_B = "c0000000-0000-4000-a000-000000000002";
const LEAD_A = "c0000000-0000-4000-a000-000000000003";
const ACTIVITY = "c0000000-0000-4000-a000-000000000004";

describe("ProjectActivity concurrent group ownership", () => {
  const prisma = createTestPrisma();
  const repository = new ProjectActivityPrismaRepository(prisma as never);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await prisma.reportingGroup.createMany({
      data: [
        { id: GROUP_A, name: "Group A" },
        { id: GROUP_B, name: "Group B" },
      ],
    });
    await prisma.user.create({
      data: {
        id: LEAD_A,
        email: "lead-a-concurrency@test.local",
        name: "Lead A",
        lastName: "Lead",
        firstName: "A",
        role: "lead",
        samlId: "lead-a-concurrency",
        reportingGroupId: GROUP_A,
      },
    });
    await prisma.projectActivity.create({
      data: {
        id: ACTIVITY,
        name: "Release duty",
        groupId: GROUP_A,
        jiraAccounts: [],
      },
    });
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  async function moveToGroupB(): Promise<void> {
    await repository.update({
      id: ACTIVITY,
      name: "Release duty",
      groupId: GROUP_B,
      linkedProductIds: [],
      jiraAccounts: [],
    });
  }

  async function assertNoCrossGroupEdge(): Promise<void> {
    const edges = await prisma.projectActivityLead.findMany({
      include: {
        activity: { select: { groupId: true } },
        lead: { select: { reportingGroupId: true } },
      },
    });

    expect(
      edges.every(
        ({ activity, lead }) =>
          lead.reportingGroupId !== null &&
          lead.reportingGroupId === activity.groupId,
      ),
    ).toBe(true);
  }

  it("rejects a move when attachment commits before move validation", async () => {
    await repository.attachLead({ activityId: ACTIVITY, leadId: LEAD_A });

    await expect(moveToGroupB()).rejects.toBeInstanceOf(
      ProjectActivityDomainError,
    );
    await assertNoCrossGroupEdge();
  });

  it("rejects attachment when the move commits before attach validation", async () => {
    await moveToGroupB();

    await expect(
      repository.attachLead({ activityId: ACTIVITY, leadId: LEAD_A }),
    ).rejects.toBeInstanceOf(ProjectActivityDomainError);
    await assertNoCrossGroupEdge();
  });

  it.each(["attach-first", "move-first"] as const)(
    "preserves the invariant when concurrent writes start %s",
    async (order) => {
      const attach = () =>
        repository.attachLead({ activityId: ACTIVITY, leadId: LEAD_A });
      const operations =
        order === "attach-first"
          ? [attach, moveToGroupB]
          : [moveToGroupB, attach];

      const outcomes = await Promise.allSettled(
        operations.map((operation) => operation()),
      );
      const failures = outcomes.filter(
        (outcome): outcome is PromiseRejectedResult =>
          outcome.status === "rejected",
      );

      expect(failures).toHaveLength(1);
      expect(failures[0]?.reason).toSatisfy(
        (error: unknown) =>
          error instanceof ProjectActivityDomainError ||
          error instanceof ProjectActivityConflictError,
      );
      await assertNoCrossGroupEdge();
    },
  );
});
