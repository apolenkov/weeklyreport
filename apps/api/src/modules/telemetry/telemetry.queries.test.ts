import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { querySettledPeriodIds } from "./telemetry.queries.js";

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
