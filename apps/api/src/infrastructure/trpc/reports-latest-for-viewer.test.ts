import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * viewer-live-status (task 1.3): `reports.latestForViewer` resolves the
 * **Status target** for the `/reports/latest` redirect. The resolver MUST:
 *   - target the current editable id (Decision 0, from
 *     `weeklyReportService.getCurrentEditableId()`) when that exact report has a
 *     viewer-visible section;
 *   - NOT search older editable periods (the gate authorizes only the current
 *     editable id) — fall to the published path instead;
 *   - otherwise resolve the newest viewer-visible `published` report
 *     (`sections.some(sectionScope)`, `periodStart desc`);
 *   - return `{ reportId: null }` when nothing qualifies.
 */

const GROUP_A = "a1111111-1111-4111-8111-111111111111";
const CURRENT_ID = "b2222222-2222-4222-8222-222222222222";
const PUBLISHED_ID = "f6666666-6666-4666-8666-666666666666";
const VIEWER_ID = "c3333333-3333-4333-8333-333333333333";
const LEAD_ID = "d4444444-4444-4444-8444-444444444444";

function buildCaller(
  findFirst: ReturnType<typeof vi.fn>,
  getCurrentEditableId: ReturnType<typeof vi.fn>,
  session: UserSession,
) {
  const deps = {
    prisma: { report: { findFirst } },
    weeklyReportService: { getCurrentEditableId },
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

describe("reports.latestForViewer", () => {
  it("targets the current editable id when it has a viewer-visible section", async () => {
    const findFirst = vi.fn(() => Promise.resolve({ id: CURRENT_ID }));
    const getCurrentEditableId = vi.fn(() => Promise.resolve(CURRENT_ID));
    const caller = buildCaller(findFirst, getCurrentEditableId, viewerSession);

    const result = await caller.reports.latestForViewer();

    expect(result).toEqual({ reportId: CURRENT_ID });
    // Resolved through the exact-id visibility check, not the published fallback.
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CURRENT_ID,
          sections: {
            some: { author: { reportingGroupId: { in: [GROUP_A] } } },
          },
        },
        select: { id: true },
      }),
    );
  });

  it("does NOT target an older editable period; falls to the newest visible published", async () => {
    // current editable exists but is NOT visible (exact-id check → null), so the
    // resolver MUST fall to the published path — never to an older editable id.
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null) // exact-id visibility check on current
      .mockResolvedValueOnce({ id: PUBLISHED_ID }); // published fallback
    const getCurrentEditableId = vi.fn(() => Promise.resolve(CURRENT_ID));
    const caller = buildCaller(findFirst, getCurrentEditableId, viewerSession);

    const result = await caller.reports.latestForViewer();

    expect(result).toEqual({ reportId: PUBLISHED_ID });
    expect(findFirst).toHaveBeenCalledTimes(2);
    // Second call is the published fallback, group-scoped, newest-first.
    expect(findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          sections: {
            some: { author: { reportingGroupId: { in: [GROUP_A] } } },
          },
        },
        orderBy: [{ periodStart: "desc" }, { id: "desc" }],
        select: { id: true },
      }),
    );
  });

  it("with no current editable period resolves the newest visible published", async () => {
    const findFirst = vi.fn(() => Promise.resolve({ id: PUBLISHED_ID }));
    const getCurrentEditableId = vi.fn(() => Promise.resolve(null));
    const caller = buildCaller(findFirst, getCurrentEditableId, viewerSession);

    const result = await caller.reports.latestForViewer();

    expect(result).toEqual({ reportId: PUBLISHED_ID });
    // No current id → skip the exact-id check, go straight to the published path.
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          sections: {
            some: { author: { reportingGroupId: { in: [GROUP_A] } } },
          },
        },
        orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("returns reportId null when neither current nor a published report is visible", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const getCurrentEditableId = vi.fn(() => Promise.resolve(null));
    const caller = buildCaller(findFirst, getCurrentEditableId, viewerSession);

    const result = await caller.reports.latestForViewer();

    expect(result).toEqual({ reportId: null });
  });

  it("a viewer with no granted groups yields a zero-row section filter and null", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const getCurrentEditableId = vi.fn(() => Promise.resolve(null));
    const caller = buildCaller(findFirst, getCurrentEditableId, {
      ...viewerSession,
      viewerGroupAccess: [],
    });

    const result = await caller.reports.latestForViewer();

    expect(result).toEqual({ reportId: null });
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
    const findFirst = vi.fn(() => Promise.resolve({ id: PUBLISHED_ID }));
    const getCurrentEditableId = vi.fn(() => Promise.resolve(null));
    const caller = buildCaller(findFirst, getCurrentEditableId, {
      userId: LEAD_ID,
      email: "lead@test.local",
      name: "Lead",
      role: "lead",
      reportingGroupId: GROUP_A,
      viewerGroupAccess: [],
      activeReportId: null,
      activeReportSectionId: null,
    });

    await caller.reports.latestForViewer();

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodStatus: "published",
          sections: { some: { authorId: LEAD_ID } },
        },
      }),
    );
  });
});
