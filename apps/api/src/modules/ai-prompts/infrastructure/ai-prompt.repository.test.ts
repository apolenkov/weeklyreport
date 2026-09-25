import { AiPromptBundleLifecycle } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  AiPromptRepository,
  type NewAiPromptBundleRevision,
} from "./ai-prompt.repository.js";

const featureKey = "lead-report-assistant";
const revisionId = "659b2767-0f86-41e2-b025-49730ca010e4";
const oldRevisionId = "759b2767-0f86-41e2-b025-49730ca010e4";
const hash = "a".repeat(64);
const servingContractVersion = "report-assistant/editor-serving/v1";

const revision = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: revisionId,
  featureKey,
  revision: 1,
  baseRevisionId: null,
  coreContractVersion: "report-assistant/core/v1",
  composerVersion: "report-assistant/composer/v1",
  servingContractVersion,
  lockedCoreSnapshot: {},
  promptContents: {},
  effectiveContentHash: hash,
  lifecycle: AiPromptBundleLifecycle.draft,
  createdBy: "admin-1",
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
  activatedAt: null,
  supersededAt: null,
  ...overrides,
});

const activationCompatibility = {
  servingContractVersion,
};

const draft: NewAiPromptBundleRevision = {
  featureKey,
  baseRevisionId: oldRevisionId,
  coreContractVersion: "report-assistant/core/v1",
  composerVersion: "report-assistant/composer/v1",
  servingContractVersion,
  lockedCoreSnapshot: {},
  promptContents: {},
  effectiveContentHash: hash,
  createdBy: "admin-1",
};

const buildHarness = () => {
  const aggregate = vi.fn().mockResolvedValue({ _max: { revision: 1 } });
  const create = vi.fn().mockResolvedValue(revision({ revision: 2 }));
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const controlUpsert = vi.fn().mockResolvedValue(undefined);
  const controlFindUnique = vi
    .fn()
    .mockResolvedValue({ activeRevisionId: oldRevisionId });
  const providerControlFindUnique = vi
    .fn()
    .mockResolvedValue({ enabled: true, activeConfigurationId: oldRevisionId });
  const controlUpdate = vi.fn().mockResolvedValue(undefined);
  const controlUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const executeRaw = vi.fn().mockResolvedValue(0);
  const transaction = {
    $executeRaw: executeRaw,
    aiFeaturePromptControl: {
      upsert: controlUpsert,
      findUnique: controlFindUnique,
      update: controlUpdate,
      updateMany: controlUpdateMany,
    },
    aiProviderControl: { findUnique: providerControlFindUnique },
    aiProviderConfiguration: {
      findUnique: vi.fn().mockResolvedValue({
        generationCompatibilityIdentity: "generation-identity",
      }),
    },
    aiPromptBundleRevision: { aggregate, create, updateMany },
  };
  const transactionRunner = vi.fn(
    (callback: (value: typeof transaction) => unknown) =>
      Promise.resolve(callback(transaction)),
  );
  const prisma = {
    $transaction: transactionRunner,
    aiFeaturePromptControl: {
      upsert: controlUpsert,
      findUnique: controlFindUnique,
    },
    aiPromptBundleRevision: {
      findFirst: vi.fn().mockResolvedValue(revision()),
      findMany: vi.fn().mockResolvedValue([revision()]),
      aggregate,
      create,
      updateMany,
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
  return {
    repository: new AiPromptRepository(prisma),
    prisma,
    aggregate,
    create,
    updateMany,
    controlUpdate,
    controlUpdateMany,
    providerControlFindUnique,
    executeRaw,
  };
};

describe("AiPromptRepository", () => {
  it("allocates feature-local revisions under a transaction lock", async () => {
    const harness = buildHarness();

    const result = await harness.repository.createDraft(draft);

    expect(result.revision).toBe(2);
    expect(harness.executeRaw).toHaveBeenCalledTimes(1);
    expect(harness.aggregate).toHaveBeenCalledWith({
      where: { featureKey },
      _max: { revision: true },
    });
    expect(harness.create).toHaveBeenCalledTimes(1);
  });

  it("conditionally deletes only draft and failed revisions", async () => {
    const harness = buildHarness();

    await expect(
      harness.repository.discardDisposable(featureKey, revisionId),
    ).resolves.toBe(true);
    expect(
      (
        harness.prisma.aiPromptBundleRevision as unknown as {
          deleteMany: ReturnType<typeof vi.fn>;
        }
      ).deleteMany,
    ).toHaveBeenCalledWith({
      where: {
        id: revisionId,
        featureKey,
        lifecycle: {
          in: [AiPromptBundleLifecycle.draft, AiPromptBundleLifecycle.failed],
        },
      },
    });
  });

  it("moves one feature pointer and supersedes the prior bundle atomically", async () => {
    const harness = buildHarness();

    await expect(
      harness.repository.activate(
        featureKey,
        revisionId,
        [AiPromptBundleLifecycle.validated],
        new Date("2026-08-10T01:00:00.000Z"),
        activationCompatibility,
      ),
    ).resolves.toBe(true);
    expect(harness.updateMany).toHaveBeenCalledTimes(2);
    expect(harness.controlUpdateMany).toHaveBeenCalledWith({
      where: { featureKey, activeRevisionId: oldRevisionId },
      data: { activeRevisionId: revisionId },
    });
  });

  it("activates a current contract without provider or evaluation checks", async () => {
    const harness = buildHarness();

    await expect(
      harness.repository.activate(
        featureKey,
        revisionId,
        [AiPromptBundleLifecycle.validated],
        new Date("2026-08-10T01:00:00.000Z"),
        {
          servingContractVersion,
        },
      ),
    ).resolves.toBe(true);
    expect(harness.providerControlFindUnique).not.toHaveBeenCalled();
    const updateCalls = harness.updateMany.mock.calls as unknown as readonly [
      Readonly<{ where: Readonly<Record<string, unknown>> }>,
    ][];
    expect(
      updateCalls.some(
        ([input]) =>
          input.where.servingContractVersion === servingContractVersion,
      ),
    ).toBe(true);
  });

  it("reports a concurrent active-pointer change without committing a mixed bundle", async () => {
    const harness = buildHarness();
    harness.controlUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      harness.repository.activate(
        featureKey,
        revisionId,
        [AiPromptBundleLifecycle.validated],
        new Date("2026-08-10T01:00:00.000Z"),
        activationCompatibility,
      ),
    ).resolves.toBe(false);
  });

  it("reports a lost supersede compare-and-set without moving the feature pointer", async () => {
    const harness = buildHarness();
    harness.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      harness.repository.activate(
        featureKey,
        revisionId,
        [AiPromptBundleLifecycle.validated],
        new Date("2026-08-10T01:00:00.000Z"),
        activationCompatibility,
      ),
    ).resolves.toBe(false);
    expect(harness.updateMany).toHaveBeenCalledTimes(2);
    expect(harness.controlUpdateMany).not.toHaveBeenCalled();
  });
});
