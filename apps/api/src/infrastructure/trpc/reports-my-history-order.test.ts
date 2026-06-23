import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * lead-history-and-submit-label (item 2): `reports.myHistory` MUST order
 * entries by reporting-period chronology (`report.periodStart desc`), NOT by
 * the section row's `createdAt` — `createdAt` is insertion time, unrelated to
 * the period a report covers. This keeps the lead history newest-period-first
 * and matches `compiledHistory`, so the summary-rail streak stays honest.
 */

function buildLeadCaller(findMany: ReturnType<typeof vi.fn>) {
  const deps = {
    prisma: { reportSection: { findMany } },
  } as unknown as Parameters<typeof createAppRouter>[0];
  return createAppRouter(deps).createCaller({
    session: {
      userId: "44444444-4444-4444-8444-444444444444",
      email: "lead@test.local",
      name: "lead user",
      role: "lead",
      activeReportId: null,
      activeReportSectionId: null,
    },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("reports.myHistory — ordering", () => {
  it("orders by report.periodStart desc, with createdAt as the stable tiebreak", async () => {
    const findMany = vi.fn(() => Promise.resolve([]));
    const caller = buildLeadCaller(findMany);

    const result = await caller.reports.myHistory();

    expect(result).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ report: { periodStart: "desc" } }, { createdAt: "desc" }],
      }),
    );
  });
});
