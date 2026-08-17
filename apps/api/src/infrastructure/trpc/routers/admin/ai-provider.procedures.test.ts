import {
  AI_PROVIDER_PROFILE_CAPABILITIES,
  type AiProviderControlRead,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../../../lib/audit-logger.js";
import { createNullLogger } from "../../../../lib/logger.js";
import { createAppRouter } from "../../trpc.router.js";

const control: AiProviderControlRead = {
  enabled: false,
  availability: "not_configured",
  activeRevisionId: null,
  profileCapabilities: AI_PROVIDER_PROFILE_CAPABILITIES.map((capability) => ({
    profile: capability.profile,
    roles: [...capability.roles],
  })),
  active: null,
  revisions: [],
};

const callerFor = (role: "admin" | "lead") => {
  const service = {
    read: vi.fn().mockResolvedValue(control),
    discard: vi.fn().mockResolvedValue({ discarded: true }),
  };
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
  it("calls discard for an admin", async () => {
    const { caller, service } = callerFor("admin");
    await expect(
      caller.admin.aiProvider.discard({
        revisionId: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toEqual({ discarded: true });
    expect(service.discard).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "admin-1",
    );
  });
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
