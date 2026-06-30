import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * `review.publish`, `review.assembledReport`, and `review.dashboard` must
 * resolve their target period from the DB via
 * `weeklyReportService.getCurrentEditableId()`, never from
 * `ctx.session.activeReportId` (baked into the JWT at login, so it can be
 * stale). These guard that resolution: routing any of the three at the stale
 * `activeReportId` would fail here.
 */

const STALE_ACTIVE_REPORT_ID = "11111111-1111-4111-8111-111111111111";
const DB_RESOLVED_REPORT_ID = "22222222-2222-4222-8222-222222222222";
const HEAD_USER_ID = "33333333-3333-4333-8333-333333333333";

function buildHeadCaller() {
  const getCurrentEditableId = vi.fn(() =>
    Promise.resolve(DB_RESOLVED_REPORT_ID),
  );
  const publishReport = vi.fn(() => Promise.resolve({ published: true }));
  const getAssembledReport = vi.fn(() => Promise.resolve({ assembled: true }));
  const getSubmissionDashboard = vi.fn(() => Promise.resolve([]));

  const deps = {
    weeklyReportService: { getCurrentEditableId },
    publicationService: { publishReport, getAssembledReport },
    reviewService: { getSubmissionDashboard },
  } as unknown as Parameters<typeof createAppRouter>[0];

  const session = {
    userId: HEAD_USER_ID,
    email: "head@test.local",
    name: "head user",
    role: "head" as const,
    // The JWT-baked active period is older than the DB-resolved current one.
    activeReportId: STALE_ACTIVE_REPORT_ID,
    activeReportSectionId: null,
  };

  const caller = createAppRouter(deps).createCaller({
    session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });

  return {
    caller,
    getCurrentEditableId,
    publishReport,
    getAssembledReport,
    getSubmissionDashboard,
    session,
  };
}

describe("review.* resolve the publish target from the DB, not the stale JWT", () => {
  it("review.publish acts on the DB-resolved period, not session.activeReportId", async () => {
    const { caller, publishReport, session } = buildHeadCaller();

    await caller.review.publish();

    expect(publishReport).toHaveBeenCalledWith(DB_RESOLVED_REPORT_ID, session);
    expect(publishReport).not.toHaveBeenCalledWith(
      STALE_ACTIVE_REPORT_ID,
      expect.anything(),
    );
  });

  it("review.assembledReport reads the DB-resolved period, not session.activeReportId", async () => {
    const { caller, getAssembledReport } = buildHeadCaller();

    await caller.review.assembledReport();

    expect(getAssembledReport).toHaveBeenCalledWith(DB_RESOLVED_REPORT_ID);
    expect(getAssembledReport).not.toHaveBeenCalledWith(STALE_ACTIVE_REPORT_ID);
  });

  it("review.dashboard scopes to the DB-resolved period, not session.activeReportId", async () => {
    const { caller, getSubmissionDashboard, session } = buildHeadCaller();

    await caller.review.dashboard();

    expect(getSubmissionDashboard).toHaveBeenCalledWith(
      DB_RESOLVED_REPORT_ID,
      session,
    );
    expect(getSubmissionDashboard).not.toHaveBeenCalledWith(
      STALE_ACTIVE_REPORT_ID,
      expect.anything(),
    );
  });
});
