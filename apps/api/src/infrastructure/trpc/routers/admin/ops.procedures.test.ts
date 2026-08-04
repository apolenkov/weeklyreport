import { describe, expect, it } from "vitest";

import { createNullAuditLogger } from "../../../../lib/audit-logger.js";
import { createNullLogger } from "../../../../lib/logger.js";
import { createAppRouter } from "../../trpc.router.js";

function buildAdminCaller() {
  const deps = {} as Parameters<typeof createAppRouter>[0];
  return createAppRouter(deps).createCaller({
    session: {
      userId: "44444444-4444-4444-8444-444444444444",
      email: "admin@test.local",
      name: "Admin User",
      role: "admin",
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

describe("admin ops dependency wiring", () => {
  it("dlqCount fails loud when the email-reminder queue is unwired", async () => {
    await expect(buildAdminCaller().admin.dlqCount()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Email reminder queue is not configured.",
    });
  });

  it("jobs.retryFailed fails loud when the jobs service is unwired", async () => {
    await expect(
      buildAdminCaller().admin.jobs.retryFailed({
        queue: "email-reminder",
        jobId: "job-1",
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Jobs service is not configured.",
    });
  });

  it("jobs.listFailed fails loud when the jobs service is unwired", async () => {
    await expect(
      buildAdminCaller().admin.jobs.listFailed({ queue: "email-reminder" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Jobs service is not configured.",
    });
  });
});
