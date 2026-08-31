import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createAppRouter } from "../trpc.router.js";

// Regression: telemetry.summary must fail loud when the service is unwired,
// never fabricate a valid-looking zero payload (no-fallback policy).
describe("telemetry router dependency wiring", () => {
  it("telemetry.summary fails loud when the telemetry service is unwired", async () => {
    const deps = {} as Parameters<typeof createAppRouter>[0];
    const caller = createAppRouter(deps).createCaller({
      session: {
        userId: "00000000-0000-4000-8000-000000000001",
        email: "head@test.local",
        name: "Head User",
        role: "head",
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });

    await expect(caller.telemetry.summary()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
