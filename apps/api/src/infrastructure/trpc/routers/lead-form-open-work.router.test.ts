import type { Role } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createLeadFormRouter } from "./lead-form.router.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";

function callerFor(role: Role | null) {
  const getOpenWork = vi.fn().mockResolvedValue({
    occurrences: [],
    nextCursor: null,
  });
  const caller = createLeadFormRouter({
    leadFormService: { getOpenWork },
  } as never).createCaller({
    session:
      role === null
        ? null
        : {
            userId: AUTHOR_ID,
            email: "lead@test.local",
            name: "Lead",
            role,
            viewerGroupAccess: [],
            activeReportId: null,
            activeReportSectionId: null,
          },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, getOpenWork };
}

describe("leadForm.openWork", () => {
  it.each(["head", "admin", "viewer", null] as const)(
    "rejects %s before the service",
    async (role) => {
      const { caller, getOpenWork } = callerFor(role);
      await expect(
        caller.openWork({ reportId: REPORT_ID }),
      ).rejects.toMatchObject({
        code: role === null ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      expect(getOpenWork).not.toHaveBeenCalled();
    },
  );

  it("forwards only the authenticated lead identity with bounded defaults", async () => {
    const { caller, getOpenWork } = callerFor("lead");

    await expect(caller.openWork({ reportId: REPORT_ID })).resolves.toEqual({
      occurrences: [],
      nextCursor: null,
    });
    expect(getOpenWork).toHaveBeenCalledWith(
      { reportId: REPORT_ID, limit: 10 },
      AUTHOR_ID,
    );
  });

  it("rejects an oversized page before the service", async () => {
    const { caller, getOpenWork } = callerFor("lead");

    await expect(
      caller.openWork({ reportId: REPORT_ID, limit: 26 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getOpenWork).not.toHaveBeenCalled();
  });
});
