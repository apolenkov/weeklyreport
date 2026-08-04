import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import { createAppRouter } from "./trpc.router.js";

// Viewer periodStatus filter is covered on getCompiledHistory in
// weekly-report.prisma-repository.test.ts.

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
  compiledHistory: ReturnType<typeof vi.fn>,
  session: UserSession,
) {
  const deps = createStubAppRouterDeps({
    weeklyReportService: { compiledHistory },
  });
  return createAppRouter(deps).createCaller({
    session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("reports.compiledHistory — router delegation", () => {
  it("forwards the session and resolved includeArchive to the service", async () => {
    const compiledHistory = vi.fn(() =>
      Promise.resolve({ entries: [], archiveCount: 0 }),
    );
    const caller = buildCaller(compiledHistory, viewerSession);

    const result = await caller.reports.compiledHistory({
      includeArchive: true,
    });

    expect(result).toEqual({ entries: [], archiveCount: 0 });
    expect(compiledHistory).toHaveBeenCalledWith(viewerSession, true);
  });

  it("defaults includeArchive to false when the input is omitted", async () => {
    const compiledHistory = vi.fn(() =>
      Promise.resolve({ entries: [], archiveCount: 0 }),
    );
    const caller = buildCaller(compiledHistory, viewerSession);

    await caller.reports.compiledHistory();

    expect(compiledHistory).toHaveBeenCalledWith(viewerSession, false);
  });
});
