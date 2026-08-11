import type { AiProviderControlRead } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../../../lib/audit-logger.js";
import { createNullLogger } from "../../../../lib/logger.js";
import { createAppRouter } from "../../trpc.router.js";

const control: AiProviderControlRead = {
  enabled: false,
  availability: "not_configured",
  activeRevisionId: null,
  active: null,
  revisions: [],
};

const callerFor = (role: "admin" | "lead") => {
  const service = { read: vi.fn().mockResolvedValue(control) };
  return {
    caller: createAppRouter({
      aiProviderService: service,
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

describe("admin.aiProvider procedures", () => {
  it("uses the service for an admin read", async () => {
    const { caller, service } = callerFor("admin");

    await expect(caller.admin.aiProvider.get()).resolves.toEqual(control);
    expect(service.read).toHaveBeenCalledOnce();
  });

  it("denies a Lead before touching the configuration service", async () => {
    const { caller, service } = callerFor("lead");

    await expect(caller.admin.aiProvider.get()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(service.read).not.toHaveBeenCalled();
  });
});
