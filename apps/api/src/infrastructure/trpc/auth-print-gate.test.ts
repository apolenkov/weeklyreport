import { describe, expect, it } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

/**
 * fix-report-surface-integrity W2 (task 3.3): the `/print` web route gate
 * needs ONE bit the regular `auth.me` cannot give it — whether the inbound
 * cookie verified as a PDF-export-scoped JWT (`ctx.isPdfExport`) and, if so,
 * the bound `reportId` (`ctx.pdfReportId`). For a `requestedBy` PDF token the
 * synthetic session IS the requester's real session, so the session alone is
 * indistinguishable from that human's own session — only these two context
 * flags discriminate the PDF worker from a human.
 *
 * `auth.printGate` is a `publicProcedure` (NOT pdfExport-guarded, so the
 * worker token reaches it) that surfaces the two flags plus the session, so
 * the web server gate reads the cookie once and branches:
 *   worker (isPdfExport && pdfReportId === reportId) → render the template
 *   authenticated human → role-specific redirect
 *   no session → login
 */

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const TEST_IP = "test-ip";

function buildCaller(ctx: {
  session: ReturnType<typeof makeSession> | null;
  isPdfExport: boolean;
  pdfReportId: string | null;
}) {
  const deps = {} as unknown as Parameters<typeof createAppRouter>[0];
  return createAppRouter(deps).createCaller({
    session: ctx.session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: TEST_IP,
    isPdfExport: ctx.isPdfExport,
    pdfReportId: ctx.pdfReportId,
  });
}

function makeSession(role: "lead" | "head" | "admin" | "viewer") {
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
