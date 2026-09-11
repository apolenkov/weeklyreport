import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { Logger } from "@nestjs/common";
import { ScheduleModule, SchedulerRegistry } from "@nestjs/schedule";
import { Test, type TestingModule } from "@nestjs/testing";
import type { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { requireEnv } from "../../lib/env.js";
import {
  assertTestDatabaseUrl,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper.js";
import { PolicyApplicatorService } from "./policy-applicator.service.js";
import { RemindersPolicyRepairScheduler } from "./reminders-policy-repair.scheduler.js";

const prisma = createTestPrisma();
const runtimes: TestingModule[] = [];
const ownedReportIds = new Set<string>();
const ownedPolicyIds = new Set<string>();
let fixtureOrdinal = 0;

async function createFixture(reportCount: number) {
  const [existingReport, existingPolicy] = await Promise.all([
    prisma.report.findFirst({
      where: {
        archived: false,
        periodState: { in: ["scheduled", "open"] },
        deadline: { not: null },
      },
      select: { id: true },
    }),
    prisma.reminderPolicy.findFirst({ select: { id: true } }),
  ]);
  if (existingReport || existingPolicy) {
    throw new Error(
      `Operational reminder lane is not isolated: report=${existingReport?.id ?? "none"} policy=${existingPolicy?.id ?? "none"}`,
    );
  }

  const policyId = randomUUID();
  const reportIds = Array.from({ length: reportCount }, () =>
    randomUUID(),
  ).sort();
  const month = fixtureOrdinal++;
  ownedPolicyIds.add(policyId);
  reportIds.forEach((id) => ownedReportIds.add(id));
  await prisma.$transaction([
    prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: -60,
        timezone: "UTC",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2200-01-01T00:00:00.000Z"),
      },
    }),
    prisma.report.createMany({
      data: reportIds.map((id, index) => {
        const periodStart = new Date(Date.UTC(2299, month, 1 + index * 8));
        return {
          id,
          periodStart,
          periodEnd: new Date(periodStart.getTime() + 6 * 86_400_000),
          deadline: new Date(periodStart.getTime() + 7 * 86_400_000),
          status: "draft" as const,
          periodStatus: "open" as const,
          periodState: "open" as const,
          archived: false,
        };
      }),
    }),
  ]);
  return { policyId, reportIds };
}

async function startRuntime(database: PrismaClient) {
  const moduleRef = await Test.createTestingModule({
    imports: [ScheduleModule.forRoot()],
    providers: [
      { provide: PrismaService, useValue: database },
      PolicyApplicatorService,
      RemindersPolicyRepairScheduler,
    ],
  }).compile();
  runtimes.push(moduleRef);
  await moduleRef.init();
  const registry = moduleRef.get(SchedulerRegistry);
  const jobs = [...registry.getCronJobs().values()];
  if (jobs.length !== 1 || !jobs[0]) {
    throw new Error(
      `Expected one registered repair cron job, received ${jobs.length}`,
    );
  }
  await jobs[0].stop();
  return {
    applicator: moduleRef.get(PolicyApplicatorService),
    scheduler: moduleRef.get(RemindersPolicyRepairScheduler),
    registry,
    job: jobs[0],
  };
}

async function rulesFor(reportIds: readonly string[], policyId: string) {
  return prisma.reminderRule.findMany({
    where: { reportId: { in: [...reportIds] }, policyId },
    orderBy: { reportId: "asc" },
    select: { reportId: true, policyId: true },
  });
}

afterEach(async () => {
  assertTestDatabaseUrl(requireEnv(process.env, "E2E_DATABASE_URL"));
  const closeResults = await Promise.allSettled(
    runtimes.splice(0).map((moduleRef) => moduleRef.close()),
  );
  const reportIds = [...ownedReportIds];
  const policyIds = [...ownedPolicyIds];
  try {
    await prisma.$transaction([
      prisma.reminderRule.deleteMany({
        where: {
          OR: [
            { reportId: { in: reportIds } },
            { policyId: { in: policyIds } },
          ],
        },
      }),
      prisma.report.deleteMany({ where: { id: { in: reportIds } } }),
      prisma.reminderPolicy.deleteMany({ where: { id: { in: policyIds } } }),
    ]);
  } finally {
    ownedReportIds.clear();
    ownedPolicyIds.clear();
    vi.restoreAllMocks();
  }
  const closeFailure = closeResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (closeFailure) throw closeFailure.reason;
});

afterAll(async () => {
  await disconnectTestPrisma();
});

describe("RemindersPolicyRepairScheduler operational recovery", () => {
  it("runs the registered hourly UTC callback without same-instance overlap", async () => {
    const { policyId, reportIds } = await createFixture(1);
    const runtime = await startRuntime(prisma);
    expect(runtime.registry.getCronJobs().size).toBe(1);
    expect(String(runtime.job.cronTime.source)).toBe("0 0-23/1 * * *");
    expect(runtime.job.cronTime.timeZone).toBe("UTC");
    expect(runtime.job.waitForCompletion).toBe(true);

    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const repairToPeriod = runtime.applicator.repairToPeriod.bind(
      runtime.applicator,
    );
    const repair = vi
      .spyOn(runtime.applicator, "repairToPeriod")
      .mockImplementation(async (reportId) => {
        entered.resolve();
        await release.promise;
        return repairToPeriod(reportId);
      });
    const firstTick = runtime.job.fireOnTick();
    try {
      await entered.promise;
      expect(runtime.job.isCallbackRunning).toBe(true);
      await runtime.job.fireOnTick();
      expect(repair).toHaveBeenCalledOnce();
    } finally {
      release.resolve();
      await firstTick;
    }

    expect(runtime.job.isCallbackRunning).toBe(false);
    await expect(rulesFor(reportIds, policyId)).resolves.toHaveLength(1);
  });

  it("lets two independent scheduler instances repair shared fixtures once", async () => {
    const { policyId, reportIds } = await createFixture(2);
    const first = await startRuntime(prisma);
    const second = await startRuntime(prisma);
    expect(first.scheduler).not.toBe(second.scheduler);
    expect(first.registry).not.toBe(second.registry);

    await Promise.all([first.job.fireOnTick(), second.job.fireOnTick()]);

    expect(await rulesFor(reportIds, policyId)).toEqual(
      reportIds.map((reportId) => ({ reportId, policyId })),
    );
  });

  it("logs one report failure, repairs later work, and recovers next tick", async () => {
    const { policyId, reportIds } = await createFixture(2);
    const [failedReportId, laterReportId] = reportIds;
    if (!failedReportId || !laterReportId) throw new Error("Missing reports");
    const runtime = await startRuntime(prisma);
    const error = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const repairToPeriod = runtime.applicator.repairToPeriod.bind(
      runtime.applicator,
    );
    let failOnce = true;
    vi.spyOn(runtime.applicator, "repairToPeriod").mockImplementation(
      (reportId) => {
        if (reportId === failedReportId && failOnce) {
          failOnce = false;
          return Promise.reject(new Error("injected repair failure"));
        }
        return repairToPeriod(reportId);
      },
    );

    await runtime.job.fireOnTick();

    expect(error).toHaveBeenCalledWith(
      "Failed to repair missing reminder rules",
      { reportId: failedReportId, error: "injected repair failure" },
    );
    expect(await rulesFor(reportIds, policyId)).toEqual([
      { reportId: laterReportId, policyId },
    ]);

    await runtime.job.fireOnTick();

    expect(error).toHaveBeenCalledOnce();
    expect(await rulesFor(reportIds, policyId)).toEqual(
      reportIds.map((reportId) => ({ reportId, policyId })),
    );
  });
});
