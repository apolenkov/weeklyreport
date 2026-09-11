import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { Reflector } from "@nestjs/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PolicyApplicatorService } from "./policy-applicator.service";
import { RemindersModule } from "./reminders.module";
import { RemindersPolicyRepairScheduler } from "./reminders-policy-repair.scheduler";

interface FindManyArgs {
  readonly where: {
    readonly archived: false;
    readonly periodState: { readonly in: readonly ["scheduled", "open"] };
    readonly deadline: { readonly not: null };
    readonly createdAt: { readonly lte: Date };
    readonly id?: { readonly gt: string };
  };
  readonly orderBy: { readonly id: "asc" };
  readonly take: 100;
  readonly select: { readonly id: true };
}

type FindMany = (args: FindManyArgs) => Promise<readonly { id: string }[]>;

function createScheduler(
  findMany: FindMany,
  repairToPeriod: (reportId: string) => Promise<unknown>,
): RemindersPolicyRepairScheduler {
  const prisma = {
    report: { findMany },
  } as unknown as PrismaService;
  const applicator = { repairToPeriod } as unknown as PolicyApplicatorService;
  return new RemindersPolicyRepairScheduler(prisma, applicator);
}

function getRepairMethod(target: object): Function {
  const method: unknown = Object.getOwnPropertyDescriptor(
    target,
    "repairMissingRules",
  )?.value;
  if (typeof method !== "function") {
    throw new TypeError("Expected repairMissingRules method");
  }
  return method;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RemindersPolicyRepairScheduler", () => {
  it("traverses every bounded page and continues after one report fails", async () => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    vi.useFakeTimers();
    const sweepStart = new Date("2026-09-06T12:00:00.000Z");
    vi.setSystemTime(sweepStart);

    const reports = Array.from({ length: 101 }, (_, index) => ({
      id: `report-${String(index + 1).padStart(3, "0")}`,
    }));
    const findMany = vi.fn<FindMany>((args) => {
      const start = args.where.id?.gt;
      return Promise.resolve(
        start === undefined ? reports.slice(0, 100) : reports.slice(100),
      );
    });
    const attempted: string[] = [];
    const repairToPeriod = vi.fn((reportId: string) => {
      attempted.push(reportId);
      return reportId === reports[0]?.id
        ? Promise.reject(new Error("repair failed"))
        : Promise.resolve(undefined);
    });
    const scheduler = createScheduler(findMany, repairToPeriod);

    await scheduler.repairMissingRules();

    expect(attempted).toEqual(reports.map(({ id }) => id));
    expect(findMany).toHaveBeenCalledTimes(2);
    const [firstQuery, secondQuery] = findMany.mock.calls.map(([args]) => args);
    expect(firstQuery?.where).toEqual({
      archived: false,
      periodState: { in: ["scheduled", "open"] },
      deadline: { not: null },
      createdAt: { lte: sweepStart },
    });
    expect(secondQuery?.where).toEqual({
      ...firstQuery?.where,
      id: { gt: "report-100" },
    });
    expect(secondQuery?.where.createdAt.lte).toBe(
      firstQuery?.where.createdAt.lte,
    );
  });

  it("does no repair work when the bounded report set is empty", async () => {
    const findMany = vi.fn<FindMany>(() => Promise.resolve([]));
    const repairToPeriod = vi.fn(() => Promise.resolve(undefined));
    const scheduler = createScheduler(findMany, repairToPeriod);

    await scheduler.repairMissingRules();

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(repairToPeriod).not.toHaveBeenCalled();
  });

  it("runs hourly in UTC without overlapping invocations", () => {
    const method = getRepairMethod(RemindersPolicyRepairScheduler.prototype);
    const metadata: unknown = new Reflector().get<unknown>(
      "SCHEDULE_CRON_OPTIONS",
      method,
    );
    expect(metadata).toMatchObject({
      cronTime: "0 0-23/1 * * *",
      timeZone: "UTC",
      waitForCompletion: true,
    });
  });

  it("is registered by the production reminders module", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      RemindersModule,
    ) as readonly unknown[];

    expect(providers).toContain(RemindersPolicyRepairScheduler);
  });
});
