import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createAppRouter } from "../../../infrastructure/trpc/trpc.router.js";
import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../../test-utils/stub-app-router-deps.js";

const VALID_UUID = "00000000-0000-4000-8000-000000000000";

function leadSession(): UserSession {
  return {
    userId: VALID_UUID,
    email: "lead@test.local",
    name: "Lead",
    role: "lead",
    reportingGroupId: VALID_UUID,
  };
}

// A reviewActionsService that must NEVER be reached for a lead — the leadership
// chain rejects before the resolver runs. Every method throws so a leak would
// surface as the wrong error, not a silent pass.
function trapService() {
  const trap = () => {
    throw new Error("resolver reached — chain did not reject the lead");
  };
  return {
    acknowledge: vi.fn(trap),
    listAcknowledgements: vi.fn(trap),
    comment: vi.fn(trap),
    deleteComment: vi.fn(trap),
    verdict: vi.fn(trap),
  };
}

function leadCaller() {
  const deps = createStubAppRouterDeps({
    reviewActionsService: trapService(),
  });
  return createAppRouter(deps).createCaller({
    session: leadSession(),
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "127.0.0.1",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("review.* leadership chain excludes lead", () => {
  it("lead is FORBIDDEN from review.acknowledge", async () => {
    await expect(
      leadCaller().review.acknowledge({
        reportId: VALID_UUID,
        groupId: VALID_UUID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lead is FORBIDDEN from review.comment", async () => {
    await expect(
      leadCaller().review.comment({ itemId: VALID_UUID, text: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lead is FORBIDDEN from review.verdict", async () => {
    await expect(
      leadCaller().review.verdict({
        reportSectionId: VALID_UUID,
        verdict: "changes_requested",
        version: 1,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lead is FORBIDDEN from review.deleteComment", async () => {
    await expect(
      leadCaller().review.deleteComment({ commentId: VALID_UUID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
