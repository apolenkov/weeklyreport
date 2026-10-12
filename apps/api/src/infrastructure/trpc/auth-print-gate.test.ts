import type { Role } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import { createAppRouter } from "./trpc.router.js";

// A requestedBy PDF token's synthetic session matches the human's own; only
// ctx.isPdfExport + ctx.pdfReportId discriminate the worker. printGate is
// publicProcedure so the worker token reaches it.

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const TEST_IP = "test-ip";

function buildCaller(ctx: {
  session: ReturnType<typeof makeSession> | null;
  isPdfExport: boolean;
  pdfReportId: string | null;
}) {
  const deps = createStubAppRouterDeps();
  return createAppRouter(deps).createCaller({
    session: ctx.session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: TEST_IP,
    isPdfExport: ctx.isPdfExport,
    pdfReportId: ctx.pdfReportId,
  });
}

function makeSession(role: Role) {
  return {
    userId: "44444444-4444-4444-8444-444444444444",
    email: `${role}@test.local`,
    name: `${role} user`,
    role,
    activeReportId: null,
    activeReportSectionId: null,
  };
}

describe("auth.printGate — PDF-worker vs human discriminator", () => {
  it("surfaces isPdfExport=true + pdfReportId for a PDF-export session", async () => {
    const caller = buildCaller({
      session: makeSession("viewer"),
      isPdfExport: true,
      pdfReportId: REPORT_ID,
    });
    const result = await caller.auth.printGate();
    expect(result.isPdfExport).toBe(true);
    expect(result.pdfReportId).toBe(REPORT_ID);
  });

  it("surfaces isPdfExport=false + the session for an authenticated human", async () => {
    const caller = buildCaller({
      session: makeSession("head"),
      isPdfExport: false,
      pdfReportId: null,
    });
    const result = await caller.auth.printGate();
    expect(result.isPdfExport).toBe(false);
    expect(result.pdfReportId).toBeNull();
    expect(result.session?.role).toBe("head");
  });

  it("surfaces a null session for an unauthenticated request", async () => {
    const caller = buildCaller({
      session: null,
      isPdfExport: false,
      pdfReportId: null,
    });
    const result = await caller.auth.printGate();
    expect(result.session).toBeNull();
    expect(result.isPdfExport).toBe(false);
  });
});
