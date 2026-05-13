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
    expect(findFirst).toHaveBeenCalledWith({
      where: { periodStatus: { in: ["open", "reopened"] } },
      orderBy: { periodStart: "desc" },
      select: { id: true },
    });
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
