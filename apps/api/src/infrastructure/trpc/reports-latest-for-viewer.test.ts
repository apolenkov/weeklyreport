import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

// Editable-vs-published resolution is covered on getVisibleReportId /
// getLatestPublishedVisibleId in weekly-report.prisma-repository.test.ts.

const viewerSession: UserSession = {
  userId: "c3333333-3333-4333-8333-333333333333",
  email: "viewer@test.local",
  name: "Viewer",
  role: "viewer",
  viewerGroupAccess: ["a1111111-1111-4111-8111-111111111111"],
  activeReportId: null,
  activeReportSectionId: null,
};

function buildCaller(
  latestForViewer: ReturnType<typeof vi.fn>,
  session: UserSession,
) {
  const deps = {
    weeklyReportService: { latestForViewer },
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

describe("reports.latestForViewer — router delegation", () => {
  it("forwards the caller's session to the service and returns its result", async () => {
    const latestForViewer = vi.fn(() =>
      Promise.resolve({ reportId: "b2222222-2222-4222-8222-222222222222" }),
    );
    const caller = buildCaller(latestForViewer, viewerSession);

    const result = await caller.reports.latestForViewer();

    expect(result).toEqual({
      reportId: "b2222222-2222-4222-8222-222222222222",
    });
    expect(latestForViewer).toHaveBeenCalledWith(viewerSession);
  });
});
