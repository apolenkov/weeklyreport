import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository";

function createRepository(findFirst: ReturnType<typeof vi.fn>) {
  const prisma = {
    report: { findFirst },
  } as unknown as PrismaService;

  return new WeeklyReportPrismaRepository(prisma);
}

describe("WeeklyReportPrismaRepository.getActiveReportId", () => {
  it("prefers the latest editable period before published history", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: "editable-report-id" });
    const repository = createRepository(findFirst);

    await expect(repository.getActiveReportId()).resolves.toBe(
      "editable-report-id",
    );

    expect(findFirst).toHaveBeenCalledOnce();
    const callArgs = findFirst.mock.calls[0]?.[0] as {
      where: { periodStatus: { in: string[] }; periodStart: { lte: Date } };
      orderBy: { periodStart: string };
      select: { id: boolean };
    };
    expect(callArgs.where.periodStatus).toEqual({ in: ["open", "reopened"] });
    expect(callArgs.where.periodStart.lte).toBeInstanceOf(Date);
    expect(callArgs.orderBy).toEqual({ periodStart: "desc" });
    expect(callArgs.select).toEqual({ id: true });
  });

  it("excludes scheduled-future periods so the current open period wins", async () => {
    // A scheduled-future period carries periodStatus="open" (the enum has no
    // "scheduled" value), so without a started-yet guard the future row would
    // win the periodStart-desc ordering. The lte(now) filter must scope the
    // query so Prisma only returns the current period.
    const currentPeriodId = "current-open-report-id";
    const findFirst = vi.fn().mockResolvedValue({ id: currentPeriodId });
    const repository = createRepository(findFirst);

    await expect(repository.getActiveReportId()).resolves.toBe(currentPeriodId);
    expect(findFirst).toHaveBeenCalledOnce();
    // The DB applies the lte(now) filter, so future rows are excluded and the
    // current (already-started) period is the only editable match.
    const callArgs = findFirst.mock.calls[0]?.[0] as {
      where: { periodStart: { lte: Date } };
    };
    expect(callArgs.where.periodStart.lte).toBeInstanceOf(Date);
  });

  it("falls back to the latest published period when no editable period exists", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "published-report-id" });
    const repository = createRepository(findFirst);

    await expect(repository.getActiveReportId()).resolves.toBe(
      "published-report-id",
    );

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: { periodStatus: "published" },
      orderBy: { periodStart: "desc" },
      select: { id: true },
    });
  });

  it("returns null when there are no editable or published periods", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = createRepository(findFirst);

    await expect(repository.getActiveReportId()).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});
