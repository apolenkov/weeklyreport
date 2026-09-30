import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createPauseGate,
  pauseBeforeReportCreate,
} from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
} from "../../../test-utils/prisma-test-helper";
import {
  ensureCurrentPeriod,
  isPeriodOverlapConflict,
  type PeriodFactorySettings,
  PeriodOverlapError,
} from "../application/period-factory.js";

const BASE_START = new Date("2026-08-03T00:00:00.000Z");
const BASE_END = new Date("2026-08-09T23:59:59.999Z");
const DEADLINE = new Date("2026-08-07T15:00:00.000Z");
const PUBLISHED_AT = new Date("2026-08-10T10:00:00.000Z");
const FACTORY_SETTINGS: PeriodFactorySettings = {
  periodLengthDays: 7,
  defaultDeadlineDays: 4,
  workingDays: "mon-fri",
  defaultTimezone: "Europe/Moscow",
  deadlineTime: "18:00",
};

describe("Report_no_live_period_overlap exclusion constraint (integration)", () => {
  const prisma = createTestPrisma();

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  function createReport(input: {
    periodStart: Date;
    periodEnd: Date;
    periodState?: "scheduled" | "open" | "published" | "archived";
  }) {
    const periodState = input.periodState ?? "open";
    const published = periodState === "published" || periodState === "archived";
    const id = crypto.randomUUID();
    return prisma.report.create({
      data: {
        id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: DEADLINE,
        status: published ? "published" : "draft",
        publishedAt: published ? PUBLISHED_AT : null,
        periodState,
        periodStatus: published ? "published" : "open",
        archived: periodState === "archived",
        ...(published
          ? {
              publishedSnapshot: publishedSnapshotFixture({
                reportId: id,
                periodStart: input.periodStart,
                periodEnd: input.periodEnd,
                deadline: DEADLINE,
                publishedAt: PUBLISHED_AT,
              }),
            }
          : {}),
      },
    });
  }

  async function captureError(run: () => Promise<unknown>): Promise<unknown> {
    return run().then(
      () => undefined,
      (error: unknown) => error,
    );
  }

  function expectOverlapError(error: unknown): void {
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const known = error as Prisma.PrismaClientKnownRequestError;
    expect(known.code).toBe("P2039");
    expect(isPeriodOverlapConflict(known)).toBe(true);
  }

  it("rejects distinct overlapping live ranges", async () => {
    await createReport({
      periodStart: BASE_START,
      periodEnd: BASE_END,
      periodState: "open",
    });

    const error = await captureError(() =>
      createReport({
        periodStart: new Date("2026-08-05T00:00:00.000Z"),
        periodEnd: new Date("2026-08-11T23:59:59.999Z"),
        periodState: "scheduled",
      }),
    );

    expectOverlapError(error);
  });

  it("rejects an exact duplicate live boundary", async () => {
    await createReport({
      periodStart: BASE_START,
      periodEnd: BASE_END,
      periodState: "open",
    });

    const error = await captureError(() =>
      createReport({
        periodStart: BASE_START,
        periodEnd: BASE_END,
        periodState: "scheduled",
      }),
    );

    expectOverlapError(error);
  });

  it("reuses one live manual range containing the login anchor", async () => {
    const manual = await createReport({
      periodStart: new Date("2026-08-04T00:00:00.000Z"),
      periodEnd: new Date("2026-08-17T23:59:59.999Z"),
      periodState: "open",
    });

    await expect(
      ensureCurrentPeriod(
        prisma,
        new Date("2026-08-10T09:00:00.000Z"),
        FACTORY_SETTINGS,
        { now: new Date("2026-08-10T09:00:00.000Z") },
      ),
    ).resolves.toMatchObject({
      created: false,
      reportId: manual.id,
    });
  });

  it("converges on a manual containing range that wins during canonical create", async () => {
    const gate = createPauseGate();
    const pausedPrisma = pauseBeforeReportCreate(prisma, gate.pause);
    const ensure = ensureCurrentPeriod(
      pausedPrisma,
      new Date("2026-08-10T09:00:00.000Z"),
      FACTORY_SETTINGS,
      { now: new Date("2026-08-10T09:00:00.000Z") },
    );
    await gate.paused;

    const manual = await createReport({
      periodStart: new Date("2026-08-09T00:00:00.000Z"),
      periodEnd: new Date("2026-08-11T23:59:59.999Z"),
      periodState: "open",
    });
    gate.release();

    await expect(ensure).resolves.toMatchObject({
      created: false,
      reportId: manual.id,
    });
    await expect(prisma.report.count()).resolves.toBe(1);
  });

  it("surfaces an unrelated partial overlap instead of choosing it", async () => {
    await createReport({
      periodStart: new Date("2026-08-09T00:00:00.000Z"),
      periodEnd: new Date("2026-08-10T08:59:59.999Z"),
      periodState: "open",
    });

    await expect(
      ensureCurrentPeriod(
        prisma,
        new Date("2026-08-10T09:00:00.000Z"),
        FACTORY_SETTINGS,
        { now: new Date("2026-08-10T09:00:00.000Z") },
      ),
    ).rejects.toBeInstanceOf(PeriodOverlapError);
  });

  it("allows overlapping historical republish rows", async () => {
    await createReport({
      periodStart: BASE_START,
      periodEnd: BASE_END,
      periodState: "published",
    });

    await expect(
      createReport({
        periodStart: BASE_START,
        periodEnd: BASE_END,
        periodState: "archived",
      }),
    ).resolves.toMatchObject({ periodState: "archived" });
  });

  it("allows adjacent non-overlapping periods", async () => {
    await createReport({ periodStart: BASE_START, periodEnd: BASE_END });

    await expect(
      createReport({
        periodStart: new Date("2026-08-10T00:00:00.000Z"),
        periodEnd: new Date("2026-08-16T23:59:59.999Z"),
      }),
    ).resolves.toMatchObject({
      periodStart: new Date("2026-08-10T00:00:00.000Z"),
    });
  });

  it("allows only one of two concurrent overlapping creates", async () => {
    const outcomes = await Promise.all([
      captureError(() =>
        createReport({ periodStart: BASE_START, periodEnd: BASE_END }),
      ),
      captureError(() =>
        createReport({
          periodStart: new Date("2026-08-06T00:00:00.000Z"),
          periodEnd: new Date("2026-08-12T23:59:59.999Z"),
          periodState: "scheduled",
        }),
      ),
    ]);

    expect(outcomes.filter((outcome) => outcome === undefined)).toHaveLength(1);
    expectOverlapError(outcomes.find((outcome) => outcome !== undefined));
  });

  it("allows only one winner when create races an envelope update", async () => {
    const existing = await createReport({
      periodStart: BASE_START,
      periodEnd: BASE_END,
    });

    const outcomes = await Promise.all([
      captureError(() =>
        prisma.report.update({
          where: { id: existing.id },
          data: { periodEnd: new Date("2026-08-12T23:59:59.999Z") },
        }),
      ),
      captureError(() =>
        createReport({
          periodStart: new Date("2026-08-10T00:00:00.000Z"),
          periodEnd: new Date("2026-08-16T23:59:59.999Z"),
        }),
      ),
    ]);

    expect(outcomes.filter((outcome) => outcome === undefined)).toHaveLength(1);
    expectOverlapError(outcomes.find((outcome) => outcome !== undefined));
  });
});
