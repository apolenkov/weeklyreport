import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { assertSeedCoverage } from "./seed-coverage-check.js";

const REPORT_ID = "seed-report";

function makePrisma() {
  const itemGroupBy = vi
    .fn()
    .mockResolvedValue(
      ["planned", "in_progress", "paused", "postponed", "done"].map(
        (workflowStatus) => ({ workflowStatus, _count: 1 }),
      ),
    );
  const riskGroupBy = vi.fn().mockResolvedValue([
    { severity: "at-risk", _count: 1 },
    { severity: "blocked", _count: 1 },
  ]);
  const itemCount = vi.fn().mockResolvedValue(1);
  return {
    itemGroupBy,
    riskGroupBy,
    itemCount,
    prisma: {
      item: { groupBy: itemGroupBy, count: itemCount },
      risk: { groupBy: riskGroupBy },
    } as unknown as PrismaClient,
  };
}

describe("assertSeedCoverage", () => {
  it("scopes every coverage query to the seeded report", async () => {
    const { prisma, itemGroupBy, riskGroupBy, itemCount } = makePrisma();

    await assertSeedCoverage(prisma, "test", REPORT_ID);

    expect(itemGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reportSection: { reportId: REPORT_ID } },
      }),
    );
    expect(riskGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reportSection: { reportId: REPORT_ID } },
      }),
    );
    expect(itemCount).toHaveBeenCalledWith({
      where: {
        priorityRank: { gt: 1 },
        reportSection: { reportId: REPORT_ID },
      },
    });
  });
});
