import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createPauseGate,
  pauseBeforeTransaction,
} from "../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "../admin/admin.prisma-repository.js";
import { ensureLeadSection } from "../report-sections/index.js";
import {
  ProjectActivityConflictError,
  ProjectActivityDomainError,
} from "./project-activity.errors";
import { ProjectActivityPrismaRepository } from "./project-activity.prisma-repository";

const GROUP_A = "c0000000-0000-4000-a000-000000000001";
const GROUP_B = "c0000000-0000-4000-a000-000000000002";
const LEAD_A = "c0000000-0000-4000-a000-000000000003";
const ACTIVITY = "c0000000-0000-4000-a000-000000000004";
const REPORT = "c0000000-0000-4000-a000-000000000005";
const PROJECT = "c0000000-0000-4000-a000-000000000006";
const LEAD_B = "c0000000-0000-4000-a000-000000000007";

describe("ProjectActivity concurrent group ownership", () => {
  const prisma = createTestPrisma();
  const repository = new ProjectActivityPrismaRepository(prisma as never);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanDatabase();
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
    await prisma.user.create({
      data: {
        id: LEAD_B,
        email: "lead-b-concurrency@test.local",
        name: "Lead B",
        lastName: "Lead",
        firstName: "B",
        role: "lead",
        samlId: "lead-b-concurrency",
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
    await prisma.project.create({
      data: { id: PROJECT, name: "Release project", leadId: LEAD_A },
    });
    await prisma.report.create({
      data: {
        id: REPORT,
        periodStart: new Date("2026-08-24T00:00:00.000Z"),
        periodEnd: new Date("2026-08-30T00:00:00.000Z"),
        deadline: new Date("2026-08-28T15:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
        periodState: "open",
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

  it.each(["attach-first", "provision-first"] as const)(
    "never misses the ActivityStatus when attachment and first provisioning commit %s",
    async (order) => {
      const gate = createPauseGate();
      const pausedPrisma = pauseBeforeTransaction(prisma, gate.pause);
      const pausedRepository = new ProjectActivityPrismaRepository(
        pausedPrisma as never,
      );

      const attachment =
        order === "attach-first"
          ? undefined
          : pausedRepository.attachLead({
              activityId: ACTIVITY,
              leadId: LEAD_A,
            });
      const provisioning =
        order === "attach-first"
          ? ensureLeadSection(pausedPrisma, REPORT, LEAD_A)
          : ensureLeadSection(prisma, REPORT, LEAD_A);

      await gate.paused;
      if (order === "attach-first") {
        await repository.attachLead({ activityId: ACTIVITY, leadId: LEAD_A });
      } else {
        await provisioning;
      }
      gate.release();
      await Promise.all([attachment, provisioning]);

      const section = await prisma.reportSection.findUniqueOrThrow({
        where: { reportId_authorId: { reportId: REPORT, authorId: LEAD_A } },
        select: { id: true },
      });
      await expect(
        prisma.activityStatus.count({
          where: { reportSectionId: section.id, activityId: ACTIVITY },
        }),
      ).resolves.toBe(1);
    },
  );

  it.each(["attach-first", "user-update-first"] as const)(
    "serializes an incompatible user group change with attachment (%s)",
    async (order) => {
      const gate = createPauseGate();
      const pausedPrisma = pauseBeforeTransaction(prisma, gate.pause);
      const pausedActivityRepository = new ProjectActivityPrismaRepository(
        pausedPrisma as never,
      );
      const pausedAdminRepository = new AdminPrismaRepository(
        pausedPrisma as never,
      );
      const normalActivityRepository = new ProjectActivityPrismaRepository(
        prisma as never,
      );
      const normalAdminRepository = new AdminPrismaRepository(prisma as never);
      const userUpdate = () =>
        pausedAdminRepository.upsertUser({
          id: LEAD_B,
          email: "lead-b-concurrency@test.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          middleName: null,
          position: null,
          role: "lead",
          reportingGroupId: GROUP_B,
          isActive: true,
        });
      const attach = () =>
        pausedActivityRepository.attachLead({
          activityId: ACTIVITY,
          leadId: LEAD_B,
        });

      const first = order === "attach-first" ? userUpdate : attach;
      const second =
        order === "attach-first"
          ? () =>
              normalActivityRepository.attachLead({
                activityId: ACTIVITY,
                leadId: LEAD_B,
              })
          : () =>
              normalAdminRepository.upsertUser({
                id: LEAD_B,
                email: "lead-b-concurrency@test.local",
                name: "Lead B",
                lastName: "Lead",
                firstName: "B",
                middleName: null,
                position: null,
                role: "lead",
                reportingGroupId: GROUP_B,
                isActive: true,
              });
      const firstPromise = first();
      await gate.paused;
      const secondPromise = second();
      await secondPromise;
      gate.release();
      const outcomes = await Promise.allSettled([firstPromise, secondPromise]);
      expect(
        outcomes.filter(
          (outcome): outcome is PromiseRejectedResult =>
            outcome.status === "rejected",
        ),
      ).toHaveLength(1);

      const edge = await prisma.projectActivityLead.findUnique({
        where: { activityId_leadId: { activityId: ACTIVITY, leadId: LEAD_B } },
        include: {
          activity: { select: { groupId: true } },
          lead: { select: { reportingGroupId: true } },
        },
      });
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: LEAD_B },
        select: { role: true, reportingGroupId: true },
      });
      expect(
        edge === null || edge.lead.reportingGroupId === edge.activity.groupId,
      ).toBe(true);
      expect(
        edge === null
          ? user.reportingGroupId === GROUP_B
          : user.reportingGroupId === GROUP_A,
      ).toBe(true);
    },
  );
});
