import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";
import { createAppRouter } from "../trpc.router.js";

// Router-wiring pin: client supplies reportId; router only forwards
// { reportId, session } to PeriodService and maps domain errors.
// Service-side reportId re-validation is pinned in period.service.test.ts.

const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const HEAD_USER_ID = "33333333-3333-4333-8333-333333333333";

function buildHeadCaller() {
  const publishPeriod = vi.fn(() =>
    Promise.resolve({ success: true as const, reportId: REPORT_ID }),
  );
  const reopenPeriod = vi.fn(() =>
    Promise.resolve({ success: true as const, reportId: REPORT_ID }),
  );

  const deps = createStubAppRouterDeps({
    periodService: { publishPeriod, reopenPeriod },
  });

  const session = {
    userId: HEAD_USER_ID,
    email: "head@test.local",
    name: "head user",
    role: "head" as const,
    activeReportId: REPORT_ID,
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

  return { caller, publishPeriod, reopenPeriod, session };
}

describe("period.publish / period.reopen router wiring", () => {
  it("period.publish forwards the input reportId and session to PeriodService.publishPeriod", async () => {
    const { caller, publishPeriod, session } = buildHeadCaller();

    await caller.period.publish({ reportId: REPORT_ID });

    expect(publishPeriod).toHaveBeenCalledExactlyOnceWith(REPORT_ID, session);
  });

  it("period.reopen forwards the input reportId and session to PeriodService.reopenPeriod", async () => {
    const { caller, reopenPeriod, session } = buildHeadCaller();

    await caller.period.reopen({ reportId: REPORT_ID });

    expect(reopenPeriod).toHaveBeenCalledExactlyOnceWith(REPORT_ID, session);
  });
});
