import type { Role } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createLeadFormRouter } from "./lead-form.router.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const INPUT = { reportId: REPORT_ID, reportSectionId: SECTION_ID };

function callerFor(role: Role | null) {
  const read = vi.fn().mockResolvedValue({ status: "unavailable" });
  const caller = createLeadFormRouter({
    retainedIncompleteRecordsService: { read },
  } as never).createCaller({
    session:
      role === null
        ? null
        : {
            userId: ACTOR_ID,
            email: "lead@test.local",
            name: "Lead",
            role,
            viewerGroupAccess: [],
            activeReportId: null,
            // A stale pointer to someone else's section must not matter.
            activeReportSectionId: "44444444-4444-4444-8444-444444444444",
          },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, read };
}

describe("leadForm.retainedIncompleteRecords", () => {
  it.each(["head", "admin", "viewer", null] as const)(
    "rejects %s before the service",
    async (role) => {
      const { caller, read } = callerFor(role);

      await expect(
        caller.retainedIncompleteRecords(INPUT),
      ).rejects.toMatchObject({
        code: role === null ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      expect(read).not.toHaveBeenCalled();
    },
  );

  it("reads the named source as the authenticated user only", async () => {
    const { caller, read } = callerFor("lead");

    await expect(caller.retainedIncompleteRecords(INPUT)).resolves.toEqual({
      status: "unavailable",
    });
    expect(read).toHaveBeenCalledExactlyOnceWith(INPUT, ACTOR_ID);
  });

  it("rejects a caller-supplied author before the service", async () => {
    const { caller, read } = callerFor("lead");

    await expect(
      caller.retainedIncompleteRecords({
        ...INPUT,
        authorId: "55555555-5555-4555-8555-555555555555",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(read).not.toHaveBeenCalled();
  });

  it("refuses a service answer that carries more than the recovery shape", async () => {
    const { caller, read } = callerFor("lead");
    read.mockResolvedValue({ status: "unavailable", version: 3 });

    await expect(caller.retainedIncompleteRecords(INPUT)).rejects.toMatchObject(
      { code: "INTERNAL_SERVER_ERROR" },
    );
  });
});
