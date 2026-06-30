import type { PeriodState } from "@customreport/shared";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PolicyApplicatorService } from "../reminders/policy-applicator.service";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { AdminPeriodOverlapError } from "./admin-shared";

/**
 * Reminder-parity regression: the admin manual create path
 * (`createPeriodManual`) must materialise reminder rules for the new period
 * via the injected `PolicyApplicatorService`, exactly as `saveSnapshot` does
 * for snapshot-created periods. Before the fix it minted the Report row and
 * returned — a manually-created period carried no reminder rules.
 */
describe("AdminPrismaRepository.createPeriodManual — reminder parity", () => {
  const CREATED = {
    id: "report-1",
    periodStart: new Date("2026-07-06T00:00:00.000Z"),
    periodEnd: new Date("2026-07-12T23:59:59.999Z"),
    deadline: new Date("2026-07-10T15:00:00.000Z"),
    periodState: "open" as PeriodState,
  };

  const INPUT = {
    periodStart: CREATED.periodStart,
    periodEnd: CREATED.periodEnd,
    deadline: CREATED.deadline,
    weekLabel: null,
    periodState: "open" as PeriodState,
  };

  function fakePrisma() {
    return {
      report: { create: vi.fn(() => Promise.resolve(CREATED)) },
    } as unknown as PrismaService;
  }

  function fakeApplicator() {
    return {
      applyToPeriod: vi.fn(() =>
        Promise.resolve({ created: 0, updated: 0, skipped: 0 }),
      ),
    } as unknown as PolicyApplicatorService;
  }

  it("applies reminder policies to the freshly-created period, forwarding now", async () => {
    const applicator = fakeApplicator();
    const repo = new AdminPrismaRepository(fakePrisma(), applicator);
    // A backfill: the new period's deadline is already in the past relative to
    // `now`. The repository MUST forward `now` so the applicator drops elapsed
    // reminders (the elapsed-skip logic itself is covered by the applicator's
    // own tests); dropping `now` would arm them to fire stale on the next tick.
    const now = new Date("2026-07-20T12:00:00.000Z");

    const result = await repo.createPeriodManual(INPUT, now);

    expect(result).toEqual(CREATED);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method
    expect(applicator.applyToPeriod).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method
    expect(applicator.applyToPeriod).toHaveBeenCalledWith(CREATED, now);
  });

  it("still mints the period when no applicator is wired", async () => {
    const repo = new AdminPrismaRepository(fakePrisma());

    const result = await repo.createPeriodManual(INPUT);

    expect(result).toEqual(CREATED);
  });

  it("propagates an applicator failure (period already committed)", async () => {
    const applicator = {
      applyToPeriod: vi.fn(() =>
        Promise.reject(new Error("reminders DB down")),
      ),
    } as unknown as PolicyApplicatorService;
    const repo = new AdminPrismaRepository(fakePrisma(), applicator);

    await expect(repo.createPeriodManual(INPUT)).rejects.toThrow(
      "reminders DB down",
    );
  });
});

/**
 * period-uniqueness (D3/D5): a race that defeats the `findOverlappingPeriod`
 * pre-check, a date edit onto a contested boundary, or an unarchive into one
 * lands on the `Report_one_open_per_boundary` partial unique index as a Prisma
 * P2002. The repository writers translate it into `AdminPeriodOverlapError`
 * (→ BAD_REQUEST), never a raw 500. Teeth: drop the catch and the raw P2002
 * surfaces, failing each assertion below.
 */
describe("AdminPrismaRepository period writers — open-boundary P2002 translation", () => {
  function openBoundaryP2002(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: "Report_one_open_per_boundary" },
      },
    );
  }

  const INPUT = {
    periodStart: new Date("2026-07-06T00:00:00.000Z"),
    periodEnd: new Date("2026-07-12T23:59:59.999Z"),
    deadline: new Date("2026-07-10T15:00:00.000Z"),
    weekLabel: null,
    periodState: "open" as PeriodState,
  };

  it("createPeriodManual: P2002 → AdminPeriodOverlapError", async () => {
    const prisma = {
      report: { create: vi.fn(() => Promise.reject(openBoundaryP2002())) },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.createPeriodManual(INPUT)).rejects.toBeInstanceOf(
      AdminPeriodOverlapError,
    );
  });

  it("updatePeriodManual: P2002 on the date-envelope edit → AdminPeriodOverlapError", async () => {
    const prisma = {
      report: { update: vi.fn(() => Promise.reject(openBoundaryP2002())) },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(
      repo.updatePeriodManual({
        reportId: "report-1",
        data: { periodStart: INPUT.periodStart, periodEnd: INPUT.periodEnd },
      }),
    ).rejects.toBeInstanceOf(AdminPeriodOverlapError);
  });

  it("unarchivePeriod: P2002 when unarchiving into a held boundary → AdminPeriodOverlapError", async () => {
    const prisma = {
      report: {
        // The unarchive reads the surviving legacy tuple, then updates into
        // periodState='open' — which is the write that can collide.
        findUnique: vi.fn(() =>
          Promise.resolve({ status: "draft", periodStatus: "open" }),
        ),
        update: vi.fn(() => Promise.reject(openBoundaryP2002())),
      },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.unarchivePeriod("report-1")).rejects.toBeInstanceOf(
      AdminPeriodOverlapError,
    );
  });

  it("re-throws a non-P2002 error unchanged (an unrelated failure is not masked)", async () => {
    const prisma = {
      report: {
        create: vi.fn(() => Promise.reject(new Error("connection reset"))),
      },
    } as unknown as PrismaService;
    const repo = new AdminPrismaRepository(prisma);

    await expect(repo.createPeriodManual(INPUT)).rejects.toThrow(
      "connection reset",
    );
  });
});
