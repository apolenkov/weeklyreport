import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * viewer-report-surface-parity (task 2.2): `reports.latestPublished` resolves
 * the redirect target for `/reports/latest`. The query MUST:
 *   - gate on `periodStatus = 'published'` — the content-read column, NOT the
 *     list `status` (so the redirect never lands on a reopened 404);
 *   - require a group-visible section (`sections.some(sectionScope)`), reusing
 *     the same group filter as `compiledHistory`;
 *   - order by `periodStart desc` and take the first;
 *   - return `{ reportId }` or `{ reportId: null }` when nothing qualifies.
 */

const GROUP_A = "a1111111-1111-4111-8111-111111111111";
const REPORT_ID = "b2222222-2222-4222-8222-222222222222";
const VIEWER_ID = "c3333333-3333-4333-8333-333333333333";
const LEAD_ID = "d4444444-4444-4444-8444-444444444444";

function buildCaller(
  findFirst: ReturnType<typeof vi.fn>,
  session: UserSession,
) {
  const deps = {
    prisma: { report: { findFirst } },
  } as unknown as Parameters<typeof createAppRouter>[0];
  return createAppRouter(deps).createCaller({
    session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

const viewerSession: UserSession = {
  userId: VIEWER_ID,
  email: "viewer@test.local",
  name: "Viewer",
  role: "viewer",
  viewerGroupAccess: [GROUP_A],
  activeReportId: null,
  activeReportSectionId: null,
};

describe("reports.latestPublished", () => {
  it("gates on periodStatus='published' + a group-visible section, ordered newest-first", async () => {
    const findFirst = vi.fn(() => Promise.resolve({ id: REPORT_ID }));
    const caller = buildCaller(findFirst, viewerSession);

    const result = await caller.reports.latestPublished();

    expect(result).toEqual({ reportId: REPORT_ID });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          sections: {
            some: { author: { reportingGroupId: { in: [GROUP_A] } } },
          },
        },
        orderBy: { periodStart: "desc" },
        select: { id: true },
      }),
    );
  });

  it("returns reportId null when nothing qualifies (empty state)", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const caller = buildCaller(findFirst, viewerSession);

    const result = await caller.reports.latestPublished();

    expect(result).toEqual({ reportId: null });
  });

  it("a viewer with no granted groups yields a zero-row section filter", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const caller = buildCaller(findFirst, {
      ...viewerSession,
      viewerGroupAccess: [],
    });

    await caller.reports.latestPublished();

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          sections: { some: { id: { in: [] } } },
        },
      }),
    );
  });

  it("a lead resolves their own authored sections, not a group filter", async () => {
    const findFirst = vi.fn(() => Promise.resolve({ id: REPORT_ID }));
    const caller = buildCaller(findFirst, {
      userId: LEAD_ID,
      email: "lead@test.local",
      name: "Lead",
      role: "lead",
      reportingGroupId: GROUP_A,
      viewerGroupAccess: [],
      activeReportId: null,
      activeReportSectionId: null,
    });

    await caller.reports.latestPublished();

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          sections: { some: { authorId: LEAD_ID } },
        },
      }),
    );
  });

  it("an admin sees every published report (no section group filter)", async () => {
    const findFirst = vi.fn(() => Promise.resolve({ id: REPORT_ID }));
    const caller = buildCaller(findFirst, {
      userId: "e5555555-5555-4555-8555-555555555555",
      email: "admin@test.local",
      name: "Admin",
      role: "admin",
      viewerGroupAccess: [],
      activeReportId: null,
      activeReportSectionId: null,
    });

    await caller.reports.latestPublished();

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodStatus: "published", sections: { some: {} } },
      }),
    );
  });
});
