import type { Prisma } from "@prisma/client";
import type { UserSession } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../../lib/logger.js";
import { lockStatusGraph } from "../../../lib/status-graph-lock.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
} from "../../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import {
  type AnalyticsCacheInvalidator,
  PeriodScopeError,
  PeriodService,
  type ReopenPolicyReader,
} from "../application/period.service";
import { NOOP_PERIOD_TELEMETRY } from "../application/period-telemetry.port.js";
import { PeriodPrismaRepository } from "./period.prisma-repository";

const ADVISORY_WAIT_TIMEOUT_MS = 2000;
const ADVISORY_POLL_INTERVAL_MS = 10;

const noopInvalidate: AnalyticsCacheInvalidator = () => Promise.resolve();
const noGatingReopenPolicy: ReopenPolicyReader = () =>
  Promise.resolve({ allowReopenAfterPublish: true, reopenWindowHours: 0 });

// Real-Prisma coverage for the single-active-reopen guard: the reopened marker
// (`periodStatus='reopened'`, `archived=false`) is matched and archived rows
// skipped; a head cannot reopen the next-latest while an admin can (recovery).
describe("PeriodService single-active-reopen guard (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new PeriodPrismaRepository(
    prisma as unknown as PrismaService,
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
  );
  const service = new PeriodService(
    repository,
    { invalidateAll: noopInvalidate },
    { getSettings: noGatingReopenPolicy },
    NOOP_PERIOD_TELEMETRY,
    createNullLogger(),
  );

  const PUBLISHED_A = "f0000000-0000-4000-a000-0000000000b1";
  const PUBLISHED_B = "f0000000-0000-4000-a000-0000000000b2";
  const REOPENED = "f0000000-0000-4000-a000-0000000000b3";
  const GROUP = "f0000000-0000-4000-a000-0000000000b4";
  const LEAD = "00000000-0000-4000-8000-0000000000c2";

  const headSession: UserSession = {
    userId: "00000000-0000-4000-8000-0000000000c1",
    email: "single-active-reopen-head@test.local",
    name: "Department Head",
    role: "head",
    activeReportId: null,
    activeReportSectionId: null,
  };
  const adminSession: UserSession = {
    ...headSession,
    userId: "00000000-0000-4000-8000-0000000000c9",
    role: "admin",
  };

  async function createReport(
    id: string,
    periodStatus: "published" | "reopened",
    periodStart: string,
    archived = false,
  ): Promise<void> {
    await prisma.report.create({
      data: {
        id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodStart),
        deadline: new Date(periodStart),
        // A reopened period keeps the published status but reverts the
        // canonical periodState to 'open' (the reopen transition's asymmetry).
        status: "published",
        periodStatus,
        periodState: archived
          ? "archived"
          : periodStatus === "reopened"
            ? "open"
            : "published",
        publishedAt: new Date(periodStart),
        ...(periodStatus === "reopened"
          ? { reopenedAt: new Date(periodStart) }
          : {}),
        archived,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: id,
          periodStart,
          periodEnd: periodStart,
          deadline: periodStart,
          publishedAt: periodStart,
        }),
      },
    });
  }

  async function createSubmittedSection(reportId: string) {
    await prisma.reportingGroup.upsert({
      where: { id: GROUP },
      update: {},
      create: { id: GROUP, name: "Single Reopen Group" },
    });
    await prisma.user.upsert({
      where: { id: headSession.userId },
      update: {},
      create: {
        id: headSession.userId,
        email: headSession.email,
        name: headSession.name,
        lastName: "Head",
        firstName: "Department",
        role: "head",
        samlId: "single-active-reopen-head",
        reportingGroupId: GROUP,
      },
    });
    await prisma.user.upsert({
      where: { id: LEAD },
      update: {},
      create: {
        id: LEAD,
        email: "single-active-reopen-lead@test.local",
        name: "Department Lead",
        lastName: "Lead",
        firstName: "Department",
        role: "lead",
        samlId: "single-active-reopen-lead",
        reportingGroupId: GROUP,
      },
    });
    return prisma.reportSection.create({
      data: {
        reportId,
        authorId: LEAD,
        status: "submitted",
        submittedAt: new Date("2026-05-18T12:00:00.000Z"),
      },
    });
  }

  async function createOpenReport(id: string, periodStart: string) {
    await prisma.report.create({
      data: {
        id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodStart),
        deadline: new Date(periodStart),
        status: "draft",
        periodState: "open",
        periodStatus: "open",
      },
    });
    await createSubmittedSection(id);
  }

  async function readPeriodState(reportId: string) {
    return {
      report: await prisma.report.findUniqueOrThrow({
        where: { id: reportId },
      }),
      sections: await prisma.reportSection.findMany({
        where: { reportId },
        orderBy: { id: "asc" },
      }),
      requests: await prisma.reopenRequest.findMany({
        where: { reportSection: { reportId } },
        orderBy: { id: "asc" },
      }),
      rules: await prisma.reminderRule.findMany({
        where: { reportId },
        orderBy: { id: "asc" },
      }),
    };
  }

  function pauseReopenAfterGates() {
    const ready = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const pausedService = new PeriodService(
      repository,
      { invalidateAll: noopInvalidate },
      {
        getSettings: async () => {
          ready.resolve();
          await resume.promise;
          return { allowReopenAfterPublish: true, reopenWindowHours: 0 };
        },
      },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );
    return {
      service: pausedService,
      ready: ready.promise,
      resume: () => resume.resolve(),
    };
  }

  beforeEach(async () => {
    await prisma.report.deleteMany();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("returns null when no reopened period exists", async () => {
    await createReport(PUBLISHED_A, "published", "2026-05-18T00:00:00.000Z");

    await expect(repository.getReopenedNonArchivedId()).resolves.toBeNull();
  });

  it("returns the reopened non-archived period", async () => {
    await createReport(REOPENED, "reopened", "2026-05-11T00:00:00.000Z");

    await expect(repository.getReopenedNonArchivedId()).resolves.toBe(REOPENED);
  });

  it("blocks a head from reopening a second period while one is already reopened (walk-back)", async () => {
    // A is the newest published, B the next-newest. The head legitimately
    // reopens A; reopening B afterwards would walk back into history.
    await createReport(PUBLISHED_A, "published", "2026-05-18T00:00:00.000Z");
    await createReport(PUBLISHED_B, "published", "2026-05-11T00:00:00.000Z");

    await service.reopenPeriod(PUBLISHED_A, headSession);
    await expect(repository.getReopenedNonArchivedId()).resolves.toBe(
      PUBLISHED_A,
    );

    // With A reopened, getLatestPublishedNonArchivedId resolves to B, so the
    // target-match passes — the single-active-reopen guard is what rejects it.
    const reopenB = service.reopenPeriod(PUBLISHED_B, headSession);
    await expect(reopenB).rejects.toBeInstanceOf(PeriodScopeError);
    await expect(reopenB).rejects.toThrow(
      "Another period is already reopened. Publish it before reopening another.",
    );

    const b = await prisma.report.findUnique({ where: { id: PUBLISHED_B } });
    expect(b?.periodStatus).toBe("published");
  });

  it("waits on the canonical advisory barrier before Head writes with no reminder policies", async () => {
    await createReport(PUBLISHED_A, "published", "2026-05-18T00:00:00.000Z");
    const section = await createSubmittedSection(PUBLISHED_A);
    await prisma.reopenRequest.create({
      data: { reportSectionId: section.id, requestedById: LEAD },
    });
    await prisma.reminderPolicy.deleteMany();
    expect(await prisma.reminderPolicy.count()).toBe(0);
    const before = await readPeriodState(PUBLISHED_A);
    const blockerPid = Promise.withResolvers<number>();
    const reopenPid = Promise.withResolvers<number>();
    const releaseBlocker = Promise.withResolvers<void>();
    async function backendPid(tx: Prisma.TransactionClient) {
      const rows = await tx.$queryRaw<{ pid: number }[]>`
        SELECT pg_backend_pid()::int AS pid
      `;
      return expectDefined(rows[0]).pid;
    }
    const blocker = prisma.$transaction(async (tx) => {
      const pid = await backendPid(tx);
      await lockStatusGraph(tx);
      blockerPid.resolve(pid);
      await releaseBlocker.promise;
    });
    // Delegate the actual transaction and record its backend before production writes.
    const observedPrisma = {
      report: prisma.report,
      $transaction: <T>(
        operation: (tx: Prisma.TransactionClient) => Promise<T>,
      ) =>
        prisma.$transaction(async (tx) => {
          reopenPid.resolve(await backendPid(tx));
          return operation(tx);
        }),
    } as unknown as PrismaService;
    const observedService = new PeriodService(
      new PeriodPrismaRepository(
        observedPrisma,
        new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
      ),
      { invalidateAll: noopInvalidate },
      { getSettings: noGatingReopenPolicy },
      NOOP_PERIOD_TELEMETRY,
      createNullLogger(),
    );
    let headReopen: ReturnType<PeriodService["reopenPeriod"]> | undefined;
    let headOutcome: Promise<unknown> | undefined;
    const headState = { finished: false };
    try {
      const holder = await Promise.race([
        blockerPid.promise,
        blocker.then(() => {
          throw new Error("Fixture released before its barrier was held.");
        }),
      ]);
      headReopen = observedService.reopenPeriod(PUBLISHED_A, headSession);
      headOutcome = headReopen.then(
        () => {
          headState.finished = true;
          return null;
        },
        (error: unknown) => {
          headState.finished = true;
          return error;
        },
      );
      const waiter = await Promise.race([
        reopenPid.promise,
        headOutcome.then((error) => {
          throw new Error(
            "Head reopen finished before its backend was recorded.",
            { cause: error },
          );
        }),
      ]);
      expect(waiter).not.toBe(holder);
      const deadline = Date.now() + ADVISORY_WAIT_TIMEOUT_MS;
      let observedWait = false;
      while (Date.now() < deadline) {
        const rows = await prisma.$queryRaw<{ blocked: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM pg_locks
            WHERE pid = ${waiter}::int
              AND locktype = 'advisory'
              AND NOT granted
          ) AND ${holder}::int = ANY(pg_blocking_pids(${waiter}::int)) AS blocked
        `;
        if (headState.finished)
          throw new Error(
            "Head reopen finished before the advisory barrier was released.",
            { cause: await headOutcome },
          );
        if (expectDefined(rows[0]).blocked) {
          observedWait = true;
          break;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, ADVISORY_POLL_INTERVAL_MS),
        );
      }
      expect(observedWait).toBe(true);
      expect(await readPeriodState(PUBLISHED_A)).toEqual(before);
    } finally {
      releaseBlocker.resolve();
      await Promise.allSettled([blocker, headOutcome]);
    }

    await expect(blocker).resolves.toBeUndefined();
    await expect(headReopen).resolves.toEqual({
      success: true,
      reportId: PUBLISHED_A,
    });
    const after = await readPeriodState(PUBLISHED_A);
    expect(after.report.periodStatus).toBe("reopened");
    expect(after.sections.map((row) => row.status)).toEqual(["draft"]);
    expect(after.requests.map((row) => row.status)).toEqual(["rejected"]);
  });

  it("rejects a Head reopen if Admin recovery commits after the Head gates with no reminder policies", async () => {
    await createReport(PUBLISHED_A, "published", "2026-05-18T00:00:00.000Z");
    await createReport(PUBLISHED_B, "published", "2026-05-11T00:00:00.000Z");
    // No ReminderPolicy rows can accidentally serialize the writers for this control.
    await prisma.reminderPolicy.deleteMany();
    expect(await prisma.reminderPolicy.count()).toBe(0);
    const section = await createSubmittedSection(PUBLISHED_A);
    await prisma.reopenRequest.create({
      data: { reportSectionId: section.id, requestedById: LEAD },
    });
    const before = await readPeriodState(PUBLISHED_A);
    const pausedHead = pauseReopenAfterGates();
    const headOutcome = pausedHead.service
      .reopenPeriod(PUBLISHED_A, headSession)
      .then(
        () => null,
        (error: unknown) => error,
      );
    try {
      await pausedHead.ready;
      await expect(
        service.reopenPeriod(PUBLISHED_B, adminSession),
      ).resolves.toEqual({
        success: true,
        reportId: PUBLISHED_B,
      });
    } finally {
      pausedHead.resume();
      await headOutcome;
    }

    expect(await headOutcome).toBeInstanceOf(PeriodScopeError);
    expect(await readPeriodState(PUBLISHED_A)).toEqual(before);
    const reopened = await prisma.report.findMany({
      where: { periodStatus: "reopened", archived: false },
      select: { id: true },
    });
    expect(reopened).toEqual([{ id: PUBLISHED_B }]);
  });

  it("allows only one Head reopen when a newer publication admits a second target with no reminder policies", async () => {
    await prisma.reminderPolicy.deleteMany();
    expect(await prisma.reminderPolicy.count()).toBe(0);
    await createOpenReport(PUBLISHED_A, "2026-05-18T00:00:00.000Z");
    await expect(
      service.publishPeriod(PUBLISHED_A, headSession),
    ).resolves.toEqual({
      success: true,
      reportId: PUBLISHED_A,
    });
    await createOpenReport(PUBLISHED_B, "2026-05-25T00:00:00.000Z");
    const first = pauseReopenAfterGates();
    const second = pauseReopenAfterGates();
    const firstOutcome = first.service
      .reopenPeriod(PUBLISHED_A, headSession)
      .then(
        () => null,
        (error: unknown) => error,
      );
    let secondOutcome: Promise<unknown> | undefined;
    const before = new Map<
      string,
      Awaited<ReturnType<typeof readPeriodState>>
    >();
    try {
      await first.ready;
      await expect(
        service.publishPeriod(PUBLISHED_B, headSession),
      ).resolves.toEqual({
        success: true,
        reportId: PUBLISHED_B,
      });
      secondOutcome = second.service
        .reopenPeriod(PUBLISHED_B, headSession)
        .then(
          () => null,
          (error: unknown) => error,
        );
      await second.ready;
      for (const reportId of [PUBLISHED_A, PUBLISHED_B]) {
        before.set(reportId, await readPeriodState(reportId));
      }
    } finally {
      first.resume();
      second.resume();
      await Promise.all([firstOutcome, secondOutcome]);
    }

    const outcomes = [await firstOutcome, await secondOutcome];
    expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome instanceof PeriodScopeError),
    ).toHaveLength(1);
    const reopened = await prisma.report.findMany({
      where: { periodStatus: "reopened", archived: false },
      select: { id: true },
    });
    expect(reopened).toHaveLength(1);
    for (const reportId of [PUBLISHED_A, PUBLISHED_B]) {
      const after = await readPeriodState(reportId);
      if (reportId === reopened[0]?.id) {
        expect(after.report.periodState).toBe("open");
        expect(after.sections.map((section) => section.status)).toEqual([
          "draft",
        ]);
      } else {
        expect(after).toEqual(before.get(reportId));
      }
    }
  });

  it("lets an admin reopen a second period while one is reopened (recovery path)", async () => {
    await createReport(PUBLISHED_A, "published", "2026-05-18T00:00:00.000Z");
    await createReport(PUBLISHED_B, "published", "2026-05-11T00:00:00.000Z");

    await service.reopenPeriod(PUBLISHED_A, headSession);

    await expect(
      service.reopenPeriod(PUBLISHED_B, adminSession),
    ).resolves.toEqual({ success: true, reportId: PUBLISHED_B });
    const b = await prisma.report.findUnique({ where: { id: PUBLISHED_B } });
    expect(b?.periodStatus).toBe("reopened");
  });
});
