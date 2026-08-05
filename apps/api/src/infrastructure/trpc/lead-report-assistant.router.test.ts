import type { Role } from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

const USER_ID = "44444444-4444-4444-8444-444444444444";
const GROUP_ID = "99999999-9999-4999-8999-999999999999";

const callerFor = (role: Role | null) =>
  createAppRouter({} as Parameters<typeof createAppRouter>[0]).createCaller({
    session: role
      ? {
          userId: USER_ID,
          email: `${role}@test.local`,
          name: `${role} user`,
          role,
          reportingGroupId: GROUP_ID,
          viewerGroupAccess: [GROUP_ID],
          activeReportId: null,
          activeReportSectionId: null,
        }
      : null,
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });

describe("leadForm.assistant role gate", () => {
  it.each(["head", "admin", "viewer"] as const)(
    "rejects %s before the assistant service runs",
    async (role) => {
      const caller = callerFor(role);

      await expect(
        caller.leadForm.assistant({
          question: "What changed?",
          resolutionTokens: [],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    },
  );

  it("rejects unauthenticated callers before input processing", async () => {
    const caller = callerFor(null);

    await expect(
      caller.leadForm.assistant({
        question: "What changed?",
        resolutionTokens: [],
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("keeps the Lead procedure on the canonical lead chain", async () => {
    const caller = callerFor("lead");

    await expect(
      caller.leadForm.assistant({
        question: "What changed?",
        resolutionTokens: [],
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
