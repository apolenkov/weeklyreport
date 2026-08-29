import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper";
import { isPeriodOverlapConflict } from "../application/period-factory.js";

const BASE_START = new Date("2026-08-03T00:00:00.000Z");
const BASE_END = new Date("2026-08-09T23:59:59.999Z");
const DEADLINE = new Date("2026-08-07T15:00:00.000Z");

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
    return prisma.report.create({
      data: {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        deadline: DEADLINE,
        status: published ? "published" : "draft",
        periodState,
        periodStatus: published ? "published" : "open",
        archived: periodState === "archived",
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
