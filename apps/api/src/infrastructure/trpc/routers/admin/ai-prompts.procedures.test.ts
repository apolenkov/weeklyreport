import type {
  AiPromptBundleRead,
  AiPromptContents,
  AiPromptFeatureRead,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../../lib/logger.js";
import type { AiPromptService } from "../../../../modules/ai-prompts/index.js";
import { createNullAuditLogger } from "../../../../test-utils/audit-logger.js";
import { createStubAppRouterDeps } from "../../../../test-utils/stub-app-router-deps.js";
import { createAppRouter } from "../../trpc.router.js";

const featureKey = "lead-report-assistant" as const;
const revisionId = "11111111-1111-4111-8111-111111111111";
const baseRevisionId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-08-10T00:00:00.000Z");
const slots = [
  "planner",
  "planner-repair",
  "grounded-answer",
  "citation-repair",
] as const;
const contents: AiPromptContents = {
  planner: "planner prompt",
  "planner-repair": "planner-repair prompt",
  "grounded-answer": "grounded-answer prompt",
  "citation-repair": "citation-repair prompt",
};
const lockedCoreSnapshot = {
  planner: "planner core",
  "planner-repair": "planner-repair core",
  "grounded-answer": "grounded-answer core",
  "citation-repair": "citation-repair core",
};
const bundle: AiPromptBundleRead = {
  id: revisionId,
  featureKey,
  revision: 1,
  baseRevisionId: null,
  coreContractVersion: "core/v1",
  composerVersion: "composer/v1",
  servingContractVersion: "serving/v1",
  servingStatus: "current",
  lockedCoreSnapshot,
  promptContents: contents,
  slots: slots.map((slot) => ({
    slot,
    lockedCore: `${slot} core`,
    promptContents: contents[slot],
    effectivePrompt: `${slot} effective`,
  })),
  effectiveContentHash: "a".repeat(64),
  lifecycle: "draft",
  createdAt: now,
  updatedAt: now,
  activatedAt: null,
  supersededAt: null,
};
const feature: AiPromptFeatureRead = {
  featureKey,
  displayName: "Report Assistant",
  description: "Grounded Lead report answers.",
  slots: slots.map((slot) => ({ slot, displayName: slot, required: true })),
  control: {
    featureKey,
    activeRevisionId: null,
    activeBundle: null,
    latestRevision: null,
    history: [],
    availability: "not_configured",
  },
};
const draft = { featureKey, baseRevisionId, promptContents: contents };
const revision = { featureKey, revisionId };
const operation = { featureKey, revisionId, lifecycle: "active" as const };

const callerFor = (role: "admin" | "lead") => {
  const service = {
    list: vi.fn().mockResolvedValue({ features: [feature] }),
    read: vi.fn().mockResolvedValue(feature),
    draft: vi.fn().mockResolvedValue(bundle),
    activate: vi.fn().mockResolvedValue(operation),
    restore: vi.fn().mockResolvedValue(operation),
    discard: vi
      .fn()
      .mockResolvedValue({ featureKey, revisionId, discarded: true }),
  } satisfies Pick<
    AiPromptService,
    "list" | "read" | "draft" | "activate" | "restore" | "discard"
  >;
  return {
    caller: createAppRouter(
      createStubAppRouterDeps({ aiPromptService: service }),
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

describe("admin.aiPrompts procedures", () => {
  it("forwards every prompt input and actor and returns mapped outputs", async () => {
    const { caller, service } = callerFor("admin");
    await expect(caller.admin.aiPrompts.list()).resolves.toEqual({
      features: [feature],
    });
    await expect(caller.admin.aiPrompts.get({ featureKey })).resolves.toEqual(
      feature,
    );
    await expect(caller.admin.aiPrompts.draft(draft)).resolves.toEqual(bundle);
    await expect(caller.admin.aiPrompts.activate(revision)).resolves.toEqual(
      operation,
    );
    await expect(caller.admin.aiPrompts.restore(revision)).resolves.toEqual(
      operation,
    );
    await expect(caller.admin.aiPrompts.discard(revision)).resolves.toEqual({
      featureKey,
      revisionId,
      discarded: true,
    });
    expect(service.list).toHaveBeenCalledOnce();
    expect(service.read).toHaveBeenCalledWith(featureKey);
    expect(service.draft).toHaveBeenCalledWith(draft, "admin-1");
    expect(service.activate).toHaveBeenCalledWith(revision, "admin-1");
    expect(service.restore).toHaveBeenCalledWith(revision, "admin-1");
    expect(service.discard).toHaveBeenCalledWith(revision, "admin-1");
  });

  it("maps unknown service failures to INTERNAL_SERVER_ERROR", async () => {
    const { caller, service } = callerFor("admin");
    service.list.mockRejectedValue(new Error("prompt failure"));
    await expect(caller.admin.aiPrompts.list()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected error",
    });
  });

  it("denies a Lead before touching any prompt procedure", async () => {
    const { caller, service } = callerFor("lead");
    const calls = [
      caller.admin.aiPrompts.list(),
      caller.admin.aiPrompts.get({ featureKey }),
      caller.admin.aiPrompts.draft(draft),
      caller.admin.aiPrompts.activate(revision),
      caller.admin.aiPrompts.restore(revision),
      caller.admin.aiPrompts.discard(revision),
    ];
    for (const call of calls)
      await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const method of Object.values(service))
      expect(method).not.toHaveBeenCalled();
  });
});
