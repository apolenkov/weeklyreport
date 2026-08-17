import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../../../lib/audit-logger.js";
import { createNullLogger } from "../../../../lib/logger.js";
import { createAppRouter } from "../../trpc.router.js";

const feature = {
  featureKey: "lead-report-assistant" as const,
  displayName: "Report Assistant",
  description: "Grounded Lead report answers.",
  slots: [
    {
      slot: "planner" as const,
      displayName: "planner",
      required: true as const,
    },
    {
      slot: "planner-repair" as const,
      displayName: "planner repair",
      required: true as const,
    },
    {
      slot: "grounded-answer" as const,
      displayName: "grounded answer",
      required: true as const,
    },
    {
      slot: "citation-repair" as const,
      displayName: "citation repair",
      required: true as const,
    },
  ],
  control: {
    featureKey: "lead-report-assistant" as const,
    activeRevisionId: null,
    activeBundle: null,
    latestRevision: null,
    history: [],
    availability: "not_configured" as const,
  },
};

const callerFor = (role: "admin" | "lead") => {
  const service = {
    list: vi.fn().mockResolvedValue({ features: [feature] }),
    get: vi.fn(),
    draft: vi.fn(),
    evaluate: vi.fn(),
    activate: vi.fn(),
    restore: vi.fn(),
    discard: vi.fn(),
  };
  return {
    caller: createAppRouter({
      aiPromptService: service,
    } as unknown as Parameters<typeof createAppRouter>[0]).createCaller({
      session: {
        userId: `${role}-1`,
        email: `${role}@test.local`,
        name: role,
        role,
        activeReportId: null,
        activeReportSectionId: null,
      },
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    }),
    service,
  };
};

describe("admin.aiPrompts procedures", () => {
  it("reads the registered feature through the service for an admin", async () => {
    const { caller, service } = callerFor("admin");

    await expect(caller.admin.aiPrompts.list()).resolves.toEqual({
      features: [feature],
    });
    expect(service.list).toHaveBeenCalledOnce();
  });

  it("denies a Lead before touching prompt management", async () => {
    const { caller, service } = callerFor("lead");

    await expect(caller.admin.aiPrompts.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(service.list).not.toHaveBeenCalled();
  });
});
