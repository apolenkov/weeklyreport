import {
  AI_PROVIDER_PROFILE_CAPABILITIES,
  type AiProviderConfigurationRead,
  type AiProviderControlRead,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../../lib/logger.js";
import type { AiProviderConfigurationService } from "../../../../modules/ai-provider/index.js";
import { createNullAuditLogger } from "../../../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../../../test-utils/stub-app-router-deps.js";
import { createAppRouter } from "../../trpc.router.js";

const revisionId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-08-10T00:00:00.000Z");
const control: AiProviderControlRead = {
  enabled: false,
  availability: "not_configured",
  runtimeFailure: null,
  activeRevisionId: null,
  profileCapabilities: AI_PROVIDER_PROFILE_CAPABILITIES.map((capability) => ({
    profile: capability.profile,
    roles: [...capability.roles],
  })),
  active: null,
  revisions: [],
};
const configuration: AiProviderConfigurationRead = {
  id: revisionId,
  lifecycle: "draft",
  generation: {
    profile: "mistral",
    baseUrl: "https://api.mistral.ai/v1",
    plannerModel: "planner",
    answerModel: "answer",
    reasoningMode: "provider_default",
    reasoningCustomValue: null,
    credentialConfigured: false,
    credentialMaskedSuffix: null,
  },
  embeddings: { mode: "reuse_generation", model: "embed", dimensions: 1024 },
  generationCompatibilityIdentity: "generation-identity",
  semanticInputVersion: "report-assistant/v1",
  testResult: null,
  latestExecution: null,
  progress: {
    completed: 0,
    total: 0,
    failed: 0,
    elapsedMs: 0,
    finishedAt: null,
  },
  createdAt: now,
  updatedAt: now,
  activatedAt: null,
};
const progress = {
  revisionId,
  completed: 1,
  total: 2,
  failed: 0,
  elapsedMs: 10,
  startedAt: now,
  finishedAt: null,
};
const draft = {
  generation: {
    profile: "mistral" as const,
    plannerModel: "planner",
    answerModel: "answer",
    reasoningMode: "provider_default" as const,
  },
  embeddings: { mode: "reuse_generation" as const, model: "embed" },
};

const callerFor = (role: "admin" | "lead") => {
  const service = {
    read: vi.fn().mockResolvedValue(control),
    save: vi.fn().mockResolvedValue(configuration),
    test: vi.fn().mockResolvedValue(configuration),
    activate: vi.fn().mockResolvedValue(control),
    disable: vi.fn().mockResolvedValue(control),
    restore: vi.fn().mockResolvedValue(control),
    discard: vi.fn().mockResolvedValue({ discarded: true }),
    progress: vi.fn().mockResolvedValue(progress),
  } satisfies Pick<
    AiProviderConfigurationService,
    | "read"
    | "save"
    | "test"
    | "activate"
    | "disable"
    | "restore"
    | "discard"
    | "progress"
  >;
  return {
    caller: createAppRouter(
      createStubAppRouterDeps({ aiProviderService: service }),
    ).createCaller({
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
  it("forwards every provider input and actor and returns mapped outputs", async () => {
    const { caller, service } = callerFor("admin");
    const revision = { revisionId };

    await expect(caller.admin.aiProvider.get()).resolves.toEqual(control);
    await expect(caller.admin.aiProvider.save(draft)).resolves.toEqual(
      configuration,
    );
    await expect(caller.admin.aiProvider.test(revision)).resolves.toEqual(
      configuration,
    );
    await expect(caller.admin.aiProvider.activate(revision)).resolves.toEqual(
      control,
    );
    await expect(caller.admin.aiProvider.disable()).resolves.toEqual(control);
    await expect(caller.admin.aiProvider.restore(revision)).resolves.toEqual(
      control,
    );
    await expect(caller.admin.aiProvider.discard(revision)).resolves.toEqual({
      discarded: true,
    });
    await expect(caller.admin.aiProvider.progress(revision)).resolves.toEqual(
      progress,
    );

    expect(service.read).toHaveBeenCalledOnce();
    expect(service.save).toHaveBeenCalledWith(draft, "admin-1");
    expect(service.test).toHaveBeenCalledWith(revisionId, "admin-1");
    expect(service.activate).toHaveBeenCalledWith(revisionId, "admin-1");
    expect(service.disable).toHaveBeenCalledWith("admin-1");
    expect(service.restore).toHaveBeenCalledWith(revisionId, "admin-1");
    expect(service.discard).toHaveBeenCalledWith(revisionId, "admin-1");
    expect(service.progress).toHaveBeenCalledWith(revisionId);
  });

  it("maps unknown service failures to INTERNAL_SERVER_ERROR", async () => {
    const { caller, service } = callerFor("admin");
    service.read.mockRejectedValue(new Error("provider failure"));
    await expect(caller.admin.aiProvider.get()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected error",
    });
  });

  it("denies a Lead before touching any provider procedure", async () => {
    const { caller, service } = callerFor("lead");
    const revision = { revisionId };
    const calls = [
      caller.admin.aiProvider.get(),
      caller.admin.aiProvider.save(draft),
      caller.admin.aiProvider.test(revision),
      caller.admin.aiProvider.activate(revision),
      caller.admin.aiProvider.disable(),
      caller.admin.aiProvider.restore(revision),
      caller.admin.aiProvider.discard(revision),
      caller.admin.aiProvider.progress(revision),
    ];
    for (const call of calls)
      await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const method of Object.values(service))
      expect(method).not.toHaveBeenCalled();
  });
});
