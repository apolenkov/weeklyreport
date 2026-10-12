import type {
  ArchiveReportDetail,
  ArchiveReportSummary,
  UserSession,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { AuditLogger } from "../../../lib/audit-logger.js";
import { createNullLogger } from "../../../lib/logger.js";
import type { ArchiveService } from "../../../modules/archive/index.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";
import { createArchiveRouter } from "./archive.router.js";

const REPORT_ID = "22222222-2222-4222-8222-222222222222";

const headSession: UserSession = {
  userId: "head-1",
  email: "head@test.local",
  name: "Head",
  role: "head",
  reportingGroupId: "group-1",
  viewerGroupAccess: ["group-1"],
  activeReportId: null,
  activeReportSectionId: null,
};

const adminSession: UserSession = { ...headSession, role: "admin" };

function makeSummary(): ArchiveReportSummary {
  return {
    reportId: REPORT_ID,
    periodStart: new Date("2026-04-06T00:00:00.000Z"),
    periodEnd: new Date("2026-04-12T23:59:59.000Z"),
    publishedAt: new Date("2026-04-09T14:00:00.000Z"),
    publishedByName: "Department Head",
    portfolioStatus: "green",
  };
}

function makeDetail(sectionCount: number): ArchiveReportDetail {
  const summary = makeSummary();
  return {
    summary,
    report: {
      reportId: REPORT_ID,
      periodStart: summary.periodStart,
      periodEnd: summary.periodEnd,
      deadline: new Date("2026-04-10T15:00:00.000Z"),
      status: "published",
      publishedAt: summary.publishedAt,
      publishedById: "00000000-0000-4000-8000-000000000001",
      publishedByName: summary.publishedByName,
      portfolioOverview: {
        status: summary.portfolioStatus,
        totals: { green: 0, yellow: 0, red: 0 },
      },
      sections: Array.from({ length: sectionCount }, (_, index) => ({
        reportSectionId: `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
        reportId: REPORT_ID,
        authorId: "33333333-3333-4333-8333-333333333333",
        authorName: "Lead",
        authorRole: "lead" as const,
        version: 1,
        status: "submitted" as const,
        submittedAt: new Date("2026-04-09T10:00:00.000Z"),
        late: false,
        projects: [],
        referencedProjects: [],
        items: [],
        risks: [],
        decisions: [],
        activities: [],
        reviews: [],
      })),
    },
  };
}

function makeAuditSpy() {
  const scopeDenied = vi.fn();
  const auditLogger: AuditLogger = {
    ...createNullAuditLogger(),
    scopeDenied,
  };
  return { auditLogger, scopeDenied };
}

function buildCaller(
  detail: ArchiveReportDetail,
  totalSectionCount: number,
  auditLogger: AuditLogger,
  session: UserSession,
) {
  const archiveService = {
    getArchiveReport: vi.fn(() =>
      Promise.resolve({ detail, totalSectionCount }),
    ),
    listArchiveReports: vi.fn(() =>
      Promise.resolve({ items: [], nextCursor: null }),
    ),
  } satisfies Pick<ArchiveService, "getArchiveReport" | "listArchiveReports">;
  return createArchiveRouter(
    createStubAppRouterDeps({ archiveService }),
  ).createCaller({
    session,
    logger: createNullLogger(),
    auditLogger,
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

// Empty (no data) must read as empty, never as a denied report: only a caller
// scoped out of a report that HAS sections records a scope-denied audit event.
describe("archive.detail audit accuracy", () => {
  it("records no scopeDenied for a genuinely empty report (zero sections total)", async () => {
    const { auditLogger, scopeDenied } = makeAuditSpy();
    const caller = buildCaller(makeDetail(0), 0, auditLogger, headSession);

    const result = await caller.detail({ reportId: REPORT_ID });

    expect(result.report.sections).toHaveLength(0);
    expect(scopeDenied).not.toHaveBeenCalled();
  });

  it("records scopeDenied when a non-admin is scoped out of a report that has sections", async () => {
    const { auditLogger, scopeDenied } = makeAuditSpy();
    const caller = buildCaller(makeDetail(0), 3, auditLogger, headSession);

    const result = await caller.detail({ reportId: REPORT_ID });

    expect(result.report.sections).toHaveLength(0);
    expect(scopeDenied).toHaveBeenCalledOnce();
    expect(scopeDenied.mock.calls[0]?.[0]).toMatchObject({
      userId: headSession.userId,
      role: "head",
      attemptedScope: "reportSection",
      resourceId: REPORT_ID,
    });
  });

  it("records no scopeDenied for an admin reading a report with sections", async () => {
    const { auditLogger, scopeDenied } = makeAuditSpy();
    const caller = buildCaller(makeDetail(3), 3, auditLogger, adminSession);

    const result = await caller.detail({ reportId: REPORT_ID });

    expect(result.report.sections).toHaveLength(3);
    expect(scopeDenied).not.toHaveBeenCalled();
  });
});
