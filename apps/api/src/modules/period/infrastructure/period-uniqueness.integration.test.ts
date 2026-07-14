import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper";
import { isOpenBoundaryConflict } from "../application/period-factory.js";

/**
 * period-uniqueness: proves the hand-written partial unique index
 * `Report_one_open_per_boundary` (init migration) actually has teeth against a
 * real database — at most one scheduled or open Report per `(periodStart,
 * periodEnd)`, while closed periods on the same boundary are exempt. Excluded
 * from the unit run (`*.integration.test.ts`); needs the `_test` DB that carries
 * the index.
 */
describe("Report_one_open_per_boundary partial unique index (integration)", () => {
  const prisma = createTestPrisma();

  const periodStart = new Date("2026-08-03T00:00:00.000Z");
  const periodEnd = new Date("2026-08-09T23:59:59.999Z");
  const deadline = new Date("2026-08-07T15:00:00.000Z");

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  function createOpenReport() {
    return prisma.report.create({
      data: {
        periodStart,
        periodEnd,
        deadline,
        status: "draft",
        periodState: "open",
        periodStatus: "open",
        archived: false,
      },
    });
  }

  function createScheduledReport() {
    return prisma.report.create({
      data: {
        periodStart,
        periodEnd,
        deadline,
        status: "draft",
        periodState: "scheduled",
        periodStatus: "open",
        archived: false,
      },
    });
  }

  /** Resolve to the thrown error (or undefined if the promise resolves). */
  async function captureError(run: () => Promise<unknown>): Promise<unknown> {
    return run().then(
      () => undefined,
      (error: unknown) => error,
    );
  }

  it("rejects a second open Report on the same boundary with P2002", async () => {
    await createOpenReport();

    const error = await captureError(createOpenReport);

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const known = error as Prisma.PrismaClientKnownRequestError;
    expect(known.code).toBe("P2002");
    // Load-bearing: assert the REAL Postgres P2002 is recognised by the actual
    // production predicate, not a hand-shaped synthetic one. The unit
    // translation tests fabricate `meta.target`; this is the only place a
    // real raw-partial-index violation proves `isOpenBoundaryConflict` matches
    // it — so every admin/reopen/scheduler translation path actually fires
    // instead of silently 500ing if Prisma surfaces `meta.target` unexpectedly.
    expect(isOpenBoundaryConflict(known)).toBe(true);

    // The shared guard must fire on the SAME live error, scoped to the boundary
    // index — this is the real-DB proof the pg-adapter matcher works.
    expect(
      isUniqueViolation(known, {
        index: "Report_one_open_per_boundary",
        columns: ["periodStart", "periodEnd"],
      }),
    ).toBe(true);

    // Load-bearing: under the pg driver adapter `meta.target` is UNSET on a real
    // P2002, so a guard reading `meta.target` alone would miss this race. Pin it
    // — a regression to `meta.target`-only matching fails here.
    expect(known.meta?.target).toBeUndefined();
  });

  it("rejects one of two concurrent scheduled Reports on the same boundary", async () => {
    const errors = await Promise.all([
      captureError(createScheduledReport),
      captureError(createScheduledReport),
    ]);

    expect(errors.filter((error) => error === undefined)).toHaveLength(1);
    const error = errors.find((candidate) => candidate !== undefined);
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const known = error as Prisma.PrismaClientKnownRequestError;
    expect(known.code).toBe("P2002");
    expect(isOpenBoundaryConflict(known)).toBe(true);
    expect(
      isUniqueViolation(known, {
        index: "Report_one_open_per_boundary",
        columns: ["periodStart", "periodEnd"],
      }),
    ).toBe(true);
    expect(known.meta?.target).toBeUndefined();
  });

  it("allows a closed (published) period to share a boundary with a new open one", async () => {
    await prisma.report.create({
      data: {
        periodStart,
        periodEnd,
        deadline,
        status: "published",
        periodState: "published",
        periodStatus: "published",
        archived: false,
      },
    });

    // The partial index only constrains live pre-published states, so a new open
    // period on the same boundary as a published one is not blocked.
    await expect(createOpenReport()).resolves.toMatchObject({
      periodState: "open",
    });
  });
});
