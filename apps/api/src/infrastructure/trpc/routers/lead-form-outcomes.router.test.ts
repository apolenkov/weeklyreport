import type { Role } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createLeadFormRouter } from "./lead-form.router.js";

const id = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const input = {
  reportSectionId: SECTION_ID,
  version: 1,
  commandId: id,
  source: { kind: "current" as const, recordId: id },
  outcome: "done" as const,
};
const restoreInput = {
  reportSectionId: SECTION_ID,
  version: 1,
  commandId: id,
  recordId: id,
};
const result = {
  section: {
    reportSectionId: SECTION_ID,
    reportId: id,
    authorId: AUTHOR_ID,
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  },
  stableId: id,
  replayed: false,
};

function callerFor(role: Role | null) {
  const resolvePlan = vi.fn().mockResolvedValue(result);
  const restorePlan = vi.fn().mockResolvedValue(result);
  const caller = createLeadFormRouter({
    leadFormService: { resolvePlan, restorePlan },
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
  return { caller, resolvePlan, restorePlan };
}

describe("leadForm plan outcome routes", () => {
  it.each(["head", "admin", "viewer", null] as const)(
    "rejects %s before either command service",
    async (role) => {
      const { caller, resolvePlan, restorePlan } = callerFor(role);
      await expect(caller.resolvePlan(input)).rejects.toMatchObject({
        code: role === null ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      await expect(caller.restorePlan(restoreInput)).rejects.toMatchObject({
        code: role === null ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      expect(resolvePlan).not.toHaveBeenCalled();
      expect(restorePlan).not.toHaveBeenCalled();
    },
  );
  it("forwards the session identity and validates both result models", async () => {
    const { caller, resolvePlan, restorePlan } = callerFor("lead");
    await expect(caller.resolvePlan(input)).resolves.toEqual(result);
    await expect(caller.restorePlan(restoreInput)).resolves.toEqual(result);
    expect(resolvePlan).toHaveBeenCalledWith(input, AUTHOR_ID);
    expect(restorePlan).toHaveBeenCalledWith(restoreInput, AUTHOR_ID);
  });
  it("rejects forged actor and missing cancellation reason before the service", async () => {
    const { caller, resolvePlan } = callerFor("lead");
    await expect(
      caller.resolvePlan({ ...input, actorId: id } as typeof input),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.resolvePlan({ ...input, outcome: "wont_do" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(resolvePlan).not.toHaveBeenCalled();
  });
});
