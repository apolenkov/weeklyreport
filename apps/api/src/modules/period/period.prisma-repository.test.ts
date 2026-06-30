import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AdminPeriodOverlapError } from "../admin/admin-shared.js";
import { WeeklyReportPrismaRepository } from "../weekly-report/weekly-report.prisma-repository.js";
import { PeriodPrismaRepository } from "./period.prisma-repository.js";

/**
 * period-uniqueness (D5): reopen moves a Report into periodState='open'. If
 * another open period already holds that boundary, the partial unique index
 * `Report_one_open_per_boundary` rejects the transaction with a P2002. The
 * repository translates it into `AdminPeriodOverlapError` (→ BAD_REQUEST),
 * never a raw 500. Teeth: drop the catch and the raw P2002 surfaces, failing
 * the first assertion.
 */
describe("PeriodPrismaRepository.reopenPeriod — open-boundary P2002 translation", () => {
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

  it("translates the boundary P2002 into AdminPeriodOverlapError", async () => {
    const prisma = {
      $transaction: vi.fn(() => Promise.reject(openBoundaryP2002())),
    } as unknown as PrismaService;
    const repo = new PeriodPrismaRepository(
      prisma,
      new WeeklyReportPrismaRepository(prisma),
    );

    await expect(repo.reopenPeriod("report-1")).rejects.toBeInstanceOf(
      AdminPeriodOverlapError,
    );
  });

  it("re-throws a non-P2002 error unchanged", async () => {
    const prisma = {
      $transaction: vi.fn(() => Promise.reject(new Error("deadlock detected"))),
    } as unknown as PrismaService;
    const repo = new PeriodPrismaRepository(
      prisma,
      new WeeklyReportPrismaRepository(prisma),
    );

    await expect(repo.reopenPeriod("report-1")).rejects.toThrow(
      "deadlock detected",
    );
  });
});
