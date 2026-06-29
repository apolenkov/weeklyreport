import type { PeriodState } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PolicyApplicatorService } from "../reminders/policy-applicator.service";
import { AdminPrismaRepository } from "./admin.prisma-repository";

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

  it("applies reminder policies to the freshly-created period", async () => {
    const applicator = fakeApplicator();
    const repo = new AdminPrismaRepository(fakePrisma(), applicator);

    const result = await repo.createPeriodManual(INPUT);

    expect(result).toEqual(CREATED);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method
    expect(applicator.applyToPeriod).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method
    expect(applicator.applyToPeriod).toHaveBeenCalledWith(CREATED);
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
