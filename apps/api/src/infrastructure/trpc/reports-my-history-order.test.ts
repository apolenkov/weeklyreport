import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { ReportSectionDomainError } from "../../modules/report-sections/index.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * lead-history-and-submit-label (item 2): `reports.myHistory` delegates to
 * `ReportSectionsService.myHistory`, threading the caller's userId through.
 * The `report.periodStart desc` ordering guarantee this test used to pin at
 * the router level now lives where the query is issued — see
 * `ReportSectionsPrismaRepository.getMyHistoryRows`'s coverage in
 * `report-sections.prisma-repository.test.ts`.
 */

function buildLeadCaller(myHistory: ReturnType<typeof vi.fn>) {
  const deps = {
    reportSectionsService: { myHistory },
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

describe("reports.myHistory — router delegation", () => {
  it("forwards the caller's userId to the service and returns its result", async () => {
    const myHistory = vi.fn(() => Promise.resolve([]));
    const caller = buildLeadCaller(myHistory);

    const result = await caller.reports.myHistory();

    expect(result).toEqual([]);
    expect(myHistory).toHaveBeenCalledTimes(1);
    expect(myHistory).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
    );
  });

  it("maps a report-section domain error to its typed tRPC code", async () => {
    const myHistory = vi.fn(() =>
      Promise.reject(
        new ReportSectionDomainError(
          "SECTION_ALREADY_SUBMITTED",
          "History is unavailable.",
        ),
      ),
    );
    const caller = buildLeadCaller(myHistory);

    await expect(caller.reports.myHistory()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "History is unavailable.",
    });
  });
});
