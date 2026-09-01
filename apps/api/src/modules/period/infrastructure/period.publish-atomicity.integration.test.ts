import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
} from "../../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import { buildTransition } from "../domain/period-transition.js";
import { PeriodPrismaRepository } from "./period.prisma-repository";

// Real-Postgres coverage for the publish compare-and-set: two concurrent
// publishes both clear the service-level check, so the guarded updateMany is
// the only thing bounding the period to a single transition.
describe("PeriodPrismaRepository publish atomicity (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new PeriodPrismaRepository(
    prisma as unknown as PrismaService,
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
  );

  const REPORT = "f0000000-0000-4000-a000-0000000000d1";
  const USER = "00000000-0000-4000-8000-0000000000d9";
  const GROUP = "f0000000-0000-4000-a000-0000000000d2";
  const PROJECT = "f0000000-0000-4000-a000-0000000000d3";

  async function expected(reportId: string) {
    const report = await repository.getReportById(reportId);
    if (!report) throw new Error(`Report ${reportId} was not found.`);
    return report;
  }

  async function createOpenReport(): Promise<void> {
    // The publish transition stamps publishedById, which references User.
    await prisma.user.create({
      data: {
        id: USER,
        email: "head-atomicity@test.local",
        name: "Atomicity Head",
        lastName: "Head",
        firstName: "Atomicity",
        role: "head",
        samlId: "head-atomicity",
      },
    });
    await prisma.report.create({
      data: {
        id: REPORT,
        periodStart: new Date("2026-05-11T00:00:00.000Z"),
        periodEnd: new Date("2026-05-17T00:00:00.000Z"),
        deadline: new Date("2026-05-15T00:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
        periodState: "open",
      },
    });
  }

  beforeEach(async () => {
    await cleanDatabase();
    await createOpenReport();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("writes identical publication metadata to the report and snapshot", async () => {
    const result = await repository.publishPeriod(
      REPORT,
      USER,
      await expected(REPORT),
    );

    expect(result).toEqual({ transitioned: true });
    const reloaded = await prisma.report.findUnique({ where: { id: REPORT } });
    const snapshot = reloaded?.publishedSnapshot as {
      status?: unknown;
      publishedAt?: unknown;
      publishedById?: unknown;
      publishedByName?: unknown;
    };
    expect(reloaded?.periodStatus).toBe("published");
    expect(reloaded?.periodState).toBe("published");
    expect(reloaded?.publishedById).toBe(USER);
    expect(snapshot).toMatchObject({
      status: "published",
      publishedAt: reloaded?.publishedAt?.toISOString(),
      publishedById: USER,
      publishedByName: "Atomicity Head",
    });
  });

  it("atomically replaces frozen scope and search rows on republish", async () => {
    await prisma.reportingGroup.create({
      data: { id: GROUP, name: "Projection Group" },
    });
    await prisma.user.update({
      where: { id: USER },
      data: { reportingGroupId: GROUP },
    });
    await prisma.project.create({
      data: { id: PROJECT, name: "Projection Project", leadId: USER },
    });
    await prisma.groupProduct.create({
      data: { groupId: GROUP, productId: PROJECT },
    });
    const section = await prisma.reportSection.create({
      data: { reportId: REPORT, authorId: USER, status: "submitted" },
    });
    const item = await prisma.item.create({
      data: {
        reportSectionId: section.id,
        projectId: PROJECT,
        type: "current",
        text: "projection first publication",
        tag: "general",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
    });

    await expect(
      repository.publishPeriod(REPORT, USER, await expected(REPORT)),
    ).resolves.toEqual({ transitioned: true });
    await expect(
      prisma.publishedSectionScope.findMany({ where: { reportId: REPORT } }),
    ).resolves.toEqual([
      expect.objectContaining({
        reportSectionId: section.id,
        authorId: USER,
        groupId: GROUP,
      }),
    ]);
    await expect(
      prisma.publishedSearchDocument.findMany({
        where: { reportId: REPORT },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        recordId: item.id,
        title: "projection first publication",
        groupId: GROUP,
      }),
    ]);

    await repository.reopenPeriod(REPORT, await expected(REPORT));
    await prisma.item.update({
      where: { id: item.id },
      data: { text: "projection second publication" },
    });
    await expect(
      repository.publishPeriod(REPORT, USER, await expected(REPORT)),
    ).resolves.toEqual({ transitioned: true });

    await expect(
      prisma.publishedSearchDocument.findMany({
        where: { reportId: REPORT },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        recordId: item.id,
        title: "projection second publication",
      }),
    ]);
  });

  it("transitions a reopened period back to published", async () => {
    // A reopened period keeps status="published" but flips
    // periodStatus to "reopened". The shared guard keys on periodStatus, not
    // status, so it must still transition here.
    const publishedAt = new Date("2026-05-17T00:00:00.000Z");
    const reopenedAt = new Date("2026-05-18T00:00:00.000Z");
    await prisma.report.update({
      where: { id: REPORT },
      data: {
        ...buildTransition("publish", { now: publishedAt, userId: USER }),
        ...buildTransition("reopen", { now: reopenedAt }),
        publishedSnapshot: publishedSnapshotFixture({
          reportId: REPORT,
          periodStart: "2026-05-11T00:00:00.000Z",
          periodEnd: "2026-05-17T00:00:00.000Z",
          deadline: "2026-05-15T00:00:00.000Z",
          publishedAt: publishedAt.toISOString(),
          publishedById: USER,
          publishedByName: "Atomicity Head",
        }),
      },
    });

    const result = await repository.publishPeriod(
      REPORT,
      USER,
      await expected(REPORT),
    );

    expect(result).toEqual({ transitioned: true });
    const reloaded = await prisma.report.findUnique({ where: { id: REPORT } });
    expect(reloaded?.periodStatus).toBe("published");
    expect(reloaded?.periodState).toBe("published");
  });

  it("reports no transition (raced) for an already-published period", async () => {
    await repository.publishPeriod(REPORT, USER, await expected(REPORT));

    await expect(
      repository.publishPeriod(REPORT, USER, await expected(REPORT)),
    ).resolves.toEqual({ transitioned: false, reason: "raced" });
  });

  it("fails closed (reason archived) for a period archived inside the window", async () => {
    // The archive transition leaves periodStatus open, so the pre-write
    // archived check cannot catch an archive landing after it. The `archived:
    // false` predicate closes the race — a zero-row match writes nothing.
    const beforeArchive = await expected(REPORT);
    await prisma.report.update({
      where: { id: REPORT },
      data: { archived: true, periodState: "archived" },
    });

    await expect(
      repository.publishPeriod(REPORT, USER, beforeArchive),
    ).resolves.toEqual({ transitioned: false, reason: "archived" });

    const reloaded = await prisma.report.findUnique({ where: { id: REPORT } });
    expect(reloaded?.archived).toBe(true);
    expect(reloaded?.status).toBe("draft");
    expect(reloaded?.periodStatus).toBe("open");
    expect(reloaded?.periodStatus).not.toBe("published");
    expect(reloaded?.periodState).toBe("archived");
    expect(reloaded?.publishedSnapshot).toBeNull();
  });

  it("reports stale when the period boundary changes after the expectation read", async () => {
    const beforeBoundaryMutation = await expected(REPORT);
    await prisma.report.update({
      where: { id: REPORT },
      data: { periodEnd: new Date("2026-05-18T00:00:00.000Z") },
    });

    await expect(
      repository.publishPeriod(REPORT, USER, beforeBoundaryMutation),
    ).resolves.toEqual({ transitioned: false, reason: "stale" });

    const reloaded = await prisma.report.findUniqueOrThrow({
      where: { id: REPORT },
    });
    expect(reloaded.periodEnd).toEqual(new Date("2026-05-18T00:00:00.000Z"));
    expect(reloaded.periodStatus).toBe("open");
    expect(reloaded.publishedSnapshot).toBeNull();
  });

  it("transitions exactly once under two concurrent publishes", async () => {
    const state = await expected(REPORT);
    const [first, second] = await Promise.all([
      repository.publishPeriod(REPORT, USER, state),
      repository.publishPeriod(REPORT, USER, state),
    ]);

    // Exactly one wins the compare-and-set; the loser matches zero rows.
    expect([first.transitioned, second.transitioned].sort()).toEqual([
      false,
      true,
    ]);

    const reloaded = await prisma.report.findUnique({ where: { id: REPORT } });
    expect(reloaded?.periodStatus).toBe("published");
    expect(reloaded?.publishedSnapshot).not.toBeNull();
  });

  it("rolls back the complete dual-state lifecycle field set as one database write", async () => {
    const lifecycleFields = {
      status: true,
      archived: true,
      periodStatus: true,
      periodState: true,
      autoPublished: true,
      autoArchived: true,
      publishedAt: true,
      publishedById: true,
      reopenedAt: true,
    } as const;
    const before = await prisma.report.findUniqueOrThrow({
      where: { id: REPORT },
      select: lifecycleFields,
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.report.update({
          where: { id: REPORT },
          // The canonical database check requires the snapshot in the same
          // lifecycle write as status='published'.
          data: {
            ...buildTransition("publish", {
              now: new Date("2026-05-29T12:00:00.000Z"),
              userId: USER,
            }),
            publishedSnapshot: publishedSnapshotFixture({
              reportId: REPORT,
              periodStart: "2026-05-11T00:00:00.000Z",
              periodEnd: "2026-05-17T00:00:00.000Z",
              deadline: "2026-05-15T00:00:00.000Z",
              publishedAt: "2026-05-29T12:00:00.000Z",
              publishedById: USER,
              publishedByName: "Atomicity Head",
            }),
          },
        });
        const insideTransaction = await tx.report.findUniqueOrThrow({
          where: { id: REPORT },
          select: lifecycleFields,
        });
        expect(insideTransaction).toMatchObject({
          status: "published",
          periodStatus: "published",
          periodState: "published",
          publishedById: USER,
        });
        throw new Error("intentional dual-state rollback");
      }),
    ).rejects.toThrow("intentional dual-state rollback");

    const after = await prisma.report.findUniqueOrThrow({
      where: { id: REPORT },
      select: lifecycleFields,
    });
    expect(after).toEqual(before);
  });
});
