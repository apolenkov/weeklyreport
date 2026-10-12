import { type Role, type UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../../lib/logger.js";
import type { ReopenRequestAdminService } from "../../../../modules/admin/index.js";
import { createNullAuditLogger } from "../../../../test-utils/audit-logger.js";
import { router } from "../../trpc.middleware.js";
import { createReopenRequestsProcedures } from "./reopen-requests.procedures.js";

const REQUEST_ID = "10000000-0000-4000-8000-000000000010";

function buildCaller(role: Role = "head") {
  const session: UserSession = {
    userId: "10000000-0000-4000-8000-000000000011",
    email: "fixture-head@example.invalid",
    name: "Fixture Head",
    role,
    activeReportId: null,
    activeReportSectionId: null,
    reportingGroupId: "10000000-0000-4000-8000-000000000012",
    reportingGroupName: "Fixture group",
  };
  const respond = vi
    .fn<ReopenRequestAdminService["respondReopenRequest"]>()
    .mockResolvedValue({
      success: true,
      decision: "approved",
      staleAutoClosed: false,
    });
  const service = {
    respondReopenRequest: respond,
    listReopenRequests:
      vi.fn<ReopenRequestAdminService["listReopenRequests"]>(),
    pendingReopenCount:
      vi.fn<ReopenRequestAdminService["pendingReopenCount"]>(),
  };
  // Only the public service port is used; private constructor dependencies are not exercised.
  const routes = router(
    createReopenRequestsProcedures({
      reopenRequestAdminService:
        service as unknown as ReopenRequestAdminService,
    }),
  );
  const caller = routes.createCaller({
    session,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, respond, session };
}

describe("canonical Head reopen responder-note admission", () => {
  it("accepts the existing 500 ASCII boundary and passes the exact note to the service", async () => {
    const { caller, respond, session } = buildCaller();
    const note = "x".repeat(500);
    await expect(
      caller.respondReopenRequest({
        id: REQUEST_ID,
        decision: "approved",
        note,
      }),
    ).resolves.toEqual({
      success: true,
      decision: "approved",
      staleAutoClosed: false,
    });
    expect(respond).toHaveBeenCalledExactlyOnceWith({
      id: REQUEST_ID,
      decision: "approved",
      note,
      decidedBy: session.userId,
      session,
    });
  });
  it("rejects 501 ASCII characters before any domain call", async () => {
    const { caller, respond } = buildCaller();
    await expect(
      caller.respondReopenRequest({
        id: REQUEST_ID,
        decision: "approved",
        note: "x".repeat(501),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(respond).not.toHaveBeenCalled();
  });
  it("preserves optional absence and exact untrimmed input at the router boundary", async () => {
    const { caller, respond } = buildCaller();
    await caller.respondReopenRequest({ id: REQUEST_ID, decision: "approved" });
    expect(respond.mock.calls[0]?.[0]).not.toHaveProperty("note");
    await caller.respondReopenRequest({
      id: REQUEST_ID,
      decision: "approved",
      note: "  accepted  ",
    });
    expect(respond.mock.calls[1]?.[0].note).toBe("  accepted  ");
  });
  it.each(["lead", "viewer"] as const)(
    "preserves canonical Head denial for %s",
    async (role) => {
      const { caller, respond } = buildCaller(role);
      await expect(
        caller.respondReopenRequest({
          id: REQUEST_ID,
          decision: "approved",
          note: "accepted",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(respond).not.toHaveBeenCalled();
    },
  );
});
