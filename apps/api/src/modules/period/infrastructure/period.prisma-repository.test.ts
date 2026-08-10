import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { AdminPeriodOverlapError } from "../../admin/index.js";
import { WeeklyReportPrismaRepository } from "../../weekly-report/index.js";
import { PeriodPrismaRepository } from "./period.prisma-repository.js";

// Reopen moves a Report into periodState='open'. If another open period holds
// that boundary, the partial unique index rejects the transaction with P2002;
// the repository translates it to AdminPeriodOverlapError (→ BAD_REQUEST).
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
