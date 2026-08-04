import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  queryActiveLeadsLastPublishedPeriod,
  querySettledPeriodIds,
} from "./telemetry.queries.js";

describe("querySettledPeriodIds", () => {
  it("selects only lifecycle-settled periods in newest-first order", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "new" }, { id: "old" }]);
    const prisma = {
      report: { findMany },
    } as unknown as PrismaService;

    await expect(
      querySettledPeriodIds(prisma, 2, {
        sections: { some: { author: { reportingGroupId: "group-a" } } },
      }),
    ).resolves.toEqual(["new", "old"]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        periodStatus: "published",
        sections: {
          some: { author: { reportingGroupId: "group-a" } },
        },
      },
      orderBy: { periodStart: "desc" },
      take: 2,
      select: { id: true },
    });
  });
});

describe("queryActiveLeadsLastPublishedPeriod", () => {
  it("counts distinct submitted authors of the latest published period", async () => {
    const prisma = {
      report: {
        findMany: vi.fn().mockResolvedValue([{ id: "period-new" }]),
      },
      reportSection: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ authorId: "a" }, { authorId: "b" }]),
      },
    } as unknown as PrismaService;

    await expect(queryActiveLeadsLastPublishedPeriod(prisma, {})).resolves.toBe(
      2,
    );
    expect(prisma.reportSection.findMany).toHaveBeenCalledWith({
      where: { reportId: "period-new", status: "submitted" },
      distinct: ["authorId"],
      select: { authorId: true },
    });
  });

  it("returns zero when no settled period exists", async () => {
    const prisma = {
      report: { findMany: vi.fn().mockResolvedValue([]) },
      reportSection: { findMany: vi.fn() },
    } as unknown as PrismaService;

    await expect(queryActiveLeadsLastPublishedPeriod(prisma, {})).resolves.toBe(
      0,
    );
    expect(prisma.reportSection.findMany).not.toHaveBeenCalled();
  });

  it("applies the section scope to the distinct-author count", async () => {
    const prisma = {
      report: {
        findMany: vi.fn().mockResolvedValue([{ id: "period-new" }]),
      },
      reportSection: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ authorId: "a" }, { authorId: "b" }]),
      },
    } as unknown as PrismaService;

    await expect(
      queryActiveLeadsLastPublishedPeriod(prisma, {
        author: { reportingGroupId: "group-a" },
      }),
    ).resolves.toBe(2);
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: {
        periodStatus: "published",
        sections: {
          some: { author: { reportingGroupId: "group-a" } },
        },
      },
      orderBy: { periodStart: "desc" },
      take: 1,
      select: { id: true },
    });
    expect(prisma.reportSection.findMany).toHaveBeenCalledWith({
      where: {
        reportId: "period-new",
        status: "submitted",
        author: { reportingGroupId: "group-a" },
      },
      distinct: ["authorId"],
      select: { authorId: true },
    });
  });
});
