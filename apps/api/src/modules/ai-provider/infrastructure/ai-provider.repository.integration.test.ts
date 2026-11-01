import { AiProviderLifecycle, AiProviderProfile } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { createNullLogger } from "../../../lib/logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import { AiProviderConfigurationService } from "../application/ai-provider.service.js";
import type { AiProviderEnvironment } from "../application/ai-provider.service-types.js";
import { AiProviderConfigurationRepository } from "./ai-provider.repository.js";
import { AI_PROVIDER_TEST_SUITE_VERSION } from "./ai-provider-test.queue.js";
import { AesGcmCredentialCodec } from "./credential-codec.js";

const prisma = createTestPrisma();
const repository = new AiProviderConfigurationRepository(
  prisma as unknown as PrismaService,
);
const discardEnvironment = {
  AI_PROVIDER_ALLOWED_ORIGINS: "https://api.mistral.ai",
  REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED: false,
  REPORT_ASSISTANT_INPUT_VERSION: "report-assistant/v1",
} satisfies AiProviderEnvironment;
const discardCodec = new AesGcmCredentialCodec("a".repeat(64), 1);

const passingTestResult = {
  status: "passed",
  generation: {
    status: "passed",
    capabilities: [{ capability: "authentication", status: "passed" }],
  },
  embeddings: {
    status: "passed",
    capabilities: [{ capability: "batch_embeddings", status: "passed" }],
  },
  testedAt: "2026-08-11T00:00:00.000Z",
};

const revision = (
  id: string,
  lifecycle: AiProviderLifecycle,
  progress: Readonly<{
    completed?: number;
    total?: number;
    failed?: number;
  }> = {},
) =>
  prisma.aiProviderConfiguration.create({
    data: {
      id,
      generationProfile: AiProviderProfile.mistral,
      generationBaseUrl: "https://api.mistral.ai/v1",
      generationEndpointIdentity: "mistral:stable-endpoint",
      plannerModel: "planner",
      answerModel: "answer",
      embeddingModel: "embed",
      embeddingDimensions: 3,
      semanticInputVersion: "report-assistant/v1",
      reasoningMode: "provider_default",
      reasoningCustomValue: null,
      generationCredentialCiphertext: "ciphertext",
      generationCredentialNonce: "nonce",
      generationCredentialTag: "tag",
      generationCredentialKeyVersion: 1,
      generationCredentialMaskedSuffix: "••••abcd",
      embeddingMode: "reuse_generation",
      embeddingProfile: null,
      embeddingBaseUrl: null,
      embeddingEndpointIdentity: null,
      embeddingCredentialCiphertext: null,
      embeddingCredentialNonce: null,
      embeddingCredentialTag: null,
      embeddingCredentialKeyVersion: null,
      embeddingCredentialMaskedSuffix: null,
      generationCompatibilityIdentity: `generation-${id}`,
      embeddingScopeIdentity: `embedding-${id}`,
      compositeTestIdentity: `composite-${id}`,
      lifecycle,
      testResult: passingTestResult,
      testedAt: new Date("2026-08-11T00:00:00.000Z"),
      preparationCompleted: progress.completed ?? 0,
      preparationTotal: progress.total ?? 0,
      preparationFailed: progress.failed ?? 0,
      preparationStartedAt: new Date("2026-08-11T00:00:00.000Z"),
      preparationFinishedAt: new Date("2026-08-11T00:00:01.000Z"),
      preparationElapsedMs: 25,
      preparationSourceFingerprint: "prepared",
      preparationSourceGeneration: 0n,
    },
  });

const createControl = (
  activeConfigurationId: string | null,
  enabled: boolean,
) =>
  prisma.aiProviderControl.create({
    data: { id: "singleton", activeConfigurationId, enabled },
  });

describe("AI provider control-plane database states", () => {
  beforeEach(async () => {
    await cleanDatabase();
    await prisma.semanticSourceState.create({ data: { id: "singleton" } });
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("claims at most one preparation from the same revision snapshot", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000034",
      AiProviderLifecycle.validated,
    );
    if (!candidate.preparationStartedAt)
      throw new Error("Preparation fixture is missing its start timestamp");
    const progress = {
      completed: 0,
      total: 0,
      failed: 0,
      elapsedMs: 0,
      startedAt: new Date(candidate.preparationStartedAt.getTime() + 1),
      finishedAt: null,
      lifecycle: AiProviderLifecycle.preparing,
      expectedRevision: {
        updatedAt: candidate.updatedAt,
        lifecycle: candidate.lifecycle,
        preparationStartedAt: candidate.preparationStartedAt,
        preparationFinishedAt: candidate.preparationFinishedAt,
      },
    };
    const claims = await Promise.all([
      repository.updateProgress(candidate.id, progress),
      repository.updateProgress(candidate.id, progress),
    ]);
    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
    expect(await repository.getRevision(candidate.id)).toMatchObject({
      lifecycle: "preparing",
      preparationStartedAt: progress.startedAt,
    });
  });

  it.each(["progress", "complete", "fail"] as const)(
    "rejects an old owner's %s callback after a new preparation claim",
    async (callback) => {
      const candidate = await revision(
        "a0000000-0000-4000-8000-000000000035",
        AiProviderLifecycle.preparing,
      );
      const oldStartedAt = candidate.preparationStartedAt;
      if (!oldStartedAt)
        throw new Error("Preparation fixture is missing its start timestamp");
      await repository.updateProgress(candidate.id, {
        completed: 0,
        total: 0,
        failed: 0,
        elapsedMs: 0,
        startedAt: new Date(oldStartedAt.getTime() + 1),
        finishedAt: null,
        lifecycle: AiProviderLifecycle.preparing,
        expectedRevision: {
          updatedAt: candidate.updatedAt,
          lifecycle: candidate.lifecycle,
          preparationStartedAt: oldStartedAt,
          preparationFinishedAt: candidate.preparationFinishedAt,
        },
      });
      const owner = await repository.getRevision(candidate.id);
      expect(owner?.preparationStartedAt).not.toEqual(oldStartedAt);
      await expect(
        repository.updateProgress(candidate.id, {
          completed: 1,
          total: 1,
          failed: callback === "fail" ? 1 : 0,
          elapsedMs: 1,
          startedAt: oldStartedAt,
          finishedAt: callback === "progress" ? null : new Date(),
          ...(callback === "complete"
            ? {}
            : {
                lifecycle:
                  callback === "fail"
                    ? AiProviderLifecycle.failed
                    : AiProviderLifecycle.preparing,
              }),
        }),
      ).resolves.toBeNull();
      expect(await repository.getRevision(candidate.id)).toEqual(owner);
    },
  );

  it("does not reset an active winner with a stale preparation snapshot", async () => {
    const winner = await revision(
      "a0000000-0000-4000-8000-000000000031",
      AiProviderLifecycle.active,
      { completed: 1, total: 1 },
    );
    await createControl(winner.id, true);
    const before = await repository.getRevision(winner.id);
    await expect(
      repository.updateProgress(winner.id, {
        completed: 0,
        total: 0,
        failed: 0,
        elapsedMs: 0,
        startedAt: new Date("2026-08-11T02:00:00.000Z"),
        finishedAt: null,
        lifecycle: AiProviderLifecycle.preparing,
        expectedRevision: {
          updatedAt: winner.updatedAt,
          lifecycle: AiProviderLifecycle.validated,
          preparationStartedAt: winner.preparationStartedAt,
          preparationFinishedAt: winner.preparationFinishedAt,
        },
      }),
    ).resolves.toBeNull();
    expect(await repository.getRevision(winner.id)).toEqual(before);
    expect(await repository.getControl()).toMatchObject({
      enabled: true,
      activeConfigurationId: winner.id,
      activeConfiguration: {
        lifecycle: "active",
        preparationCompleted: 1,
        preparationTotal: 1,
      },
    });
  });

  it("keeps a superseded revision superseded when an active retest returns late", async () => {
    const a = await revision(
      "a0000000-0000-4000-8000-000000000032",
      AiProviderLifecycle.superseded,
      { completed: 1, total: 1 },
    );
    const b = await revision(
      "a0000000-0000-4000-8000-000000000033",
      AiProviderLifecycle.active,
      { completed: 1, total: 1 },
    );
    await createControl(b.id, true);
    const execution = await repository.createOrReuseProviderExecution(a.id, {
      testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
    });
    expect(await repository.startExecution(execution.id, 1)).toBe(true);
    await repository.setClaimedTestResult({
      id: a.id,
      executionId: execution.id,
      executionAttempt: 1,
      result: passingTestResult,
      status: "passed",
      embeddingDimensions: 3,
      testedAt: new Date("2026-08-11T02:00:00.000Z"),
      currentLifecycle: AiProviderLifecycle.active,
      compositeTestIdentity: a.compositeTestIdentity,
      outcome: "passed",
      failureCode: null,
      checks: [],
    });
    expect(await repository.getRevision(a.id)).toMatchObject({
      lifecycle: "superseded",
      testResult: passingTestResult,
    });
    expect(await repository.getControl()).toMatchObject({
      activeConfigurationId: b.id,
      activeConfiguration: { lifecycle: "active" },
    });
    expect(
      await prisma.aiProviderConfiguration.count({
        where: { lifecycle: AiProviderLifecycle.active },
      }),
    ).toBe(1);
  });

  it("discards a failed attempt while preserving active and rollback revisions", async () => {
    const active = await revision(
      "a0000000-0000-4000-8000-000000000006",
      AiProviderLifecycle.active,
    );
    const superseded = await revision(
      "a0000000-0000-4000-8000-000000000007",
      AiProviderLifecycle.superseded,
    );
    const failed = await revision(
      "a0000000-0000-4000-8000-000000000008",
      AiProviderLifecycle.failed,
    );
    await createControl(active.id, true);

    await expect(repository.discardDisposable(failed.id)).resolves.toBe(true);
    const control = await repository.getControl();
    expect(control?.enabled).toBe(true);
    expect(control?.activeConfigurationId).toBe(active.id);
    expect(control?.revisions.map(({ id }) => id)).toEqual(
      expect.arrayContaining([active.id, superseded.id]),
    );
    await expect(
      prisma.aiProviderConfiguration.findUnique({ where: { id: failed.id } }),
    ).resolves.toBeNull();
  });

  it("discards through the application service without changing active state", async () => {
    const active = await revision(
      "a0000000-0000-4000-8000-00000000000c",
      AiProviderLifecycle.active,
    );
    const superseded = await revision(
      "a0000000-0000-4000-8000-00000000000d",
      AiProviderLifecycle.superseded,
    );
    const failed = await revision(
      "a0000000-0000-4000-8000-00000000000e",
      AiProviderLifecycle.failed,
    );
    await createControl(active.id, true);
    const events: Record<string, unknown>[] = [];
    const service = new AiProviderConfigurationService(
      repository,
      discardCodec,
      discardEnvironment,
      undefined,
      undefined,
      {
        ...createNullLogger(),
        info: (_message, event) => events.push({ ...event }),
      },
    );

    await expect(service.discard(failed.id, "admin-1")).resolves.toEqual({
      discarded: true,
    });
    const control = await repository.getControl();
    expect(control?.activeConfigurationId).toBe(active.id);
    expect(control?.activeConfiguration).toMatchObject({
      id: active.id,
      lifecycle: "active",
    });
    expect(control?.revisions.map(({ id }) => id)).toEqual(
      expect.arrayContaining([active.id, superseded.id]),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        event: "ai_provider.discarded",
        actorId: "admin-1",
        revisionId: failed.id,
      }),
    );
  });

  it("does not delete missing or protected revisions", async () => {
    const active = await revision(
      "a0000000-0000-4000-8000-000000000009",
      AiProviderLifecycle.active,
    );
    const superseded = await revision(
      "a0000000-0000-4000-8000-00000000000a",
      AiProviderLifecycle.superseded,
    );
    await createControl(active.id, true);

    await expect(
      repository.discardDisposable("a0000000-0000-4000-8000-00000000000b"),
    ).resolves.toBe(false);
    await expect(repository.discardDisposable(superseded.id)).resolves.toBe(
      false,
    );
    await expect(
      prisma.aiProviderConfiguration.findUnique({
        where: { id: superseded.id },
      }),
    ).resolves.toMatchObject({ lifecycle: AiProviderLifecycle.superseded });
  });

  it("represents unconfigured and disabled states without deleting revisions", async () => {
    await expect(repository.getControl()).resolves.toBeNull();

    const active = await revision(
      "a0000000-0000-4000-8000-000000000001",
      AiProviderLifecycle.active,
    );
    await createControl(active.id, false);

    await expect(repository.getControl()).resolves.toMatchObject({
      enabled: false,
      activeConfigurationId: active.id,
      activeConfiguration: { lifecycle: AiProviderLifecycle.active },
      revisions: [{ id: active.id }],
    });
  });

  it("round-trips active, preparing, failed, and superseded revisions", async () => {
    const active = await revision(
      "a0000000-0000-4000-8000-000000000002",
      AiProviderLifecycle.active,
    );
    const superseded = await revision(
      "a0000000-0000-4000-8000-000000000003",
      AiProviderLifecycle.superseded,
    );
    const preparing = await revision(
      "a0000000-0000-4000-8000-000000000004",
      AiProviderLifecycle.preparing,
      { completed: 4, total: 9 },
    );
    const failed = await revision(
      "a0000000-0000-4000-8000-000000000005",
      AiProviderLifecycle.failed,
      { completed: 4, total: 9, failed: 1 },
    );
    await createControl(active.id, true);

    const stored = await repository.getControl();

    expect(stored?.activeConfiguration?.id).toBe(active.id);
    expect(stored?.revisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: active.id, lifecycle: "active" }),
        expect.objectContaining({
          id: superseded.id,
          lifecycle: "superseded",
        }),
        expect.objectContaining({
          id: preparing.id,
          lifecycle: "preparing",
          preparationCompleted: 4,
          preparationTotal: 9,
        }),
        expect.objectContaining({
          id: failed.id,
          lifecycle: "failed",
          preparationFailed: 1,
        }),
      ]),
    );
  });

  it("persists bounded provider test metadata", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-00000000000f",
      AiProviderLifecycle.draft,
    );
    const testedAt = new Date("2026-08-11T01:00:00.000Z");

    await repository.setTestResult({
      id: candidate.id,
      result: {
        status: "passed",
        generation: {
          status: "passed",
          capabilities: [{ capability: "structured_answer", status: "passed" }],
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: testedAt.toISOString(),
      },
      status: "passed",
      embeddingDimensions: 3,
      testedAt,
      currentLifecycle: AiProviderLifecycle.draft,
    });

    await expect(
      prisma.aiProviderConfiguration.findUnique({
        where: { id: candidate.id },
        select: { testResult: true },
      }),
    ).resolves.toMatchObject({
      testResult: { generation: { status: "passed" } },
    });
  });

  it("reclaims a crashed processing attempt without allowing its late completion to overwrite the retry", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000025",
      AiProviderLifecycle.draft,
    );
    const execution = await repository.createOrReuseProviderExecution(
      candidate.id,
      { testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION },
    );

    await expect(repository.startExecution(execution.id, 1)).resolves.toBe(
      true,
    );
    await expect(repository.startExecution(execution.id, 1)).resolves.toBe(
      false,
    );
    await expect(repository.startExecution(execution.id, 2)).resolves.toBe(
      true,
    );
    await expect(
      repository.completeExecution(execution.id, "passed", {
        failureCode: null,
        checks: [],
        executionAttempt: 1,
      }),
    ).resolves.toBe(false);
    await expect(
      repository.completeExecution(execution.id, "passed", {
        failureCode: null,
        checks: [],
        executionAttempt: 2,
      }),
    ).resolves.toBe(true);

    await expect(
      prisma.aiProviderTestExecution.findUnique({
        where: { id: execution.id },
        select: { state: true, outcome: true, executionAttempt: true },
      }),
    ).resolves.toEqual({
      state: "completed",
      outcome: "passed",
      executionAttempt: 2,
    });
  });

  it.each(["inconclusive", "incompatible"] as const)(
    "creates one new execution when a %s provider test is retried",
    async (terminalOutcome) => {
      const candidate = await revision(
        "a0000000-0000-4000-8000-00000000001f",
        AiProviderLifecycle.failed,
      );
      const request = {
        testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
      };
      const first = await repository.createOrReuseProviderExecution(
        candidate.id,
        request,
      );
      await repository.startExecution(first.id);
      const checkOutcome =
        terminalOutcome === "incompatible" ? "incompatible" : "inconclusive";
      await repository.completeExecution(first.id, terminalOutcome, {
        failureCode:
          terminalOutcome === "inconclusive"
            ? "provider_transient_failure"
            : null,
        checks: [
          {
            code: "generation.authentication",
            outcome: checkOutcome,
            passedCount: 0,
            failedCount: 1,
          },
          {
            code: "embeddings.authentication",
            outcome: "passed",
            passedCount: 1,
            failedCount: 0,
          },
        ],
      });

      await expect(
        prisma.aiProviderTestExecution.findUnique({
          where: { id: first.id },
          select: { identity: true, testSuiteVersion: true, checks: true },
        }),
      ).resolves.toEqual({
        identity: `${candidate.compositeTestIdentity}:revision:${candidate.id}`,
        testSuiteVersion: request.testSuiteVersion,
        checks: [
          {
            code: "generation.authentication",
            outcome: checkOutcome,
            passedCount: 0,
            failedCount: 1,
          },
          {
            code: "embeddings.authentication",
            outcome: "passed",
            passedCount: 1,
            failedCount: 0,
          },
        ],
      });

      const retried = await Promise.all([
        repository.createOrReuseProviderExecution(candidate.id, request),
        repository.createOrReuseProviderExecution(candidate.id, request),
      ]);

      expect(new Set(retried.map(({ id }) => id)).size).toBe(1);
      expect(retried[0].id).not.toBe(first.id);
      await expect(
        prisma.aiProviderTestExecution.count({
          where: { providerRevisionId: candidate.id },
        }),
      ).resolves.toBe(2);
    },
  );

  it("creates a fresh execution for an explicit retest after a passed run", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-00000000001e",
      AiProviderLifecycle.failed,
    );
    const request = { testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION };
    const first = await repository.createOrReuseProviderExecution(
      candidate.id,
      request,
    );
    await repository.startExecution(first.id);
    await repository.completeExecution(first.id, "passed", {
      failureCode: null,
      checks: [],
    });

    const retest = await repository.createOrReuseProviderExecution(
      candidate.id,
      request,
    );
    expect(retest).toMatchObject({ created: true, state: "queued" });
    expect(retest.id).not.toBe(first.id);
    await expect(
      prisma.aiProviderTestExecution.count({
        where: { providerRevisionId: candidate.id },
      }),
    ).resolves.toBe(2);
  });

  it("does not activate from a passed execution belonging to an older suite", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-00000000001d",
      AiProviderLifecycle.preparing,
      { completed: 120, total: 120 },
    );
    await createControl(null, false);
    const oldExecution = await repository.createOrReuseProviderExecution(
      candidate.id,
      { testSuiteVersion: "provider-test-v1" },
    );
    await repository.startExecution(oldExecution.id);
    await repository.completeExecution(oldExecution.id, "passed", {
      failureCode: null,
      checks: [],
    });

    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T02:00:00.000Z"),
        {
          mode: "prepared",
          sourceFingerprint: "prepared",
          sourceGeneration: 0n,
        },
      ),
    ).resolves.toBe(false);
    await expect(repository.getControl()).resolves.toMatchObject({
      activeConfigurationId: null,
      enabled: false,
    });
  });

  it("does not reuse a terminal execution from another revision", async () => {
    const previous = await revision(
      "a0000000-0000-4000-8000-000000000020",
      AiProviderLifecycle.failed,
    );
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000021",
      AiProviderLifecycle.draft,
    );
    await prisma.aiProviderConfiguration.update({
      where: { id: candidate.id },
      data: { compositeTestIdentity: previous.compositeTestIdentity },
    });
    const request = { testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION };
    const previousExecution = await repository.createOrReuseProviderExecution(
      previous.id,
      request,
    );
    await repository.completeExecution(
      previousExecution.id,
      "configuration_error",
      {
        failureCode: "provider_authentication_failed",
        checks: [],
      },
    );

    const current = await repository.createOrReuseProviderExecution(
      candidate.id,
      request,
    );

    expect(current).toMatchObject({ created: true });
    expect(current.id).not.toBe(previousExecution.id);
    await expect(
      prisma.aiProviderTestExecution.findUnique({
        where: { id: current.id },
        select: { identity: true, providerRevisionId: true, state: true },
      }),
    ).resolves.toEqual({
      identity: `${previous.compositeTestIdentity}:revision:${candidate.id}`,
      providerRevisionId: candidate.id,
      state: "queued",
    });
  });

  it("activates from a passed revision-scoped provider execution", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000022",
      AiProviderLifecycle.preparing,
      { completed: 120, total: 120 },
    );
    await createControl(null, false);
    const execution = await repository.createOrReuseProviderExecution(
      candidate.id,
      { testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION },
    );
    await repository.startExecution(execution.id);
    await repository.completeExecution(execution.id, "passed", {
      failureCode: null,
      checks: [],
    });

    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T02:00:00.000Z"),
        {
          mode: "prepared",
          sourceFingerprint: "prepared",
          sourceGeneration: 0n,
        },
      ),
    ).resolves.toBe(true);
    await expect(repository.getControl()).resolves.toMatchObject({
      enabled: true,
      activeConfigurationId: candidate.id,
      activeConfiguration: {
        id: candidate.id,
        lifecycle: "active",
      },
    });
  });

  it("rejects activation when a report source changes after preparation", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000023",
      AiProviderLifecycle.preparing,
      { completed: 1, total: 1 },
    );
    await createControl(null, false);
    const preparedGeneration = (
      await prisma.semanticSourceState.upsert({
        where: { id: "singleton" },
        create: { id: "singleton" },
        update: {},
        select: { generation: true },
      })
    ).generation;
    await repository.updateProgress(candidate.id, {
      completed: 1,
      total: 1,
      failed: 0,
      elapsedMs: 1,
      startedAt: new Date("2026-08-11T01:00:00.000Z"),
      finishedAt: new Date("2026-08-11T01:00:01.000Z"),
      sourceFingerprint: "prepared",
      sourceGeneration: preparedGeneration,
      expectedRevision: {
        updatedAt: candidate.updatedAt,
        lifecycle: candidate.lifecycle,
        preparationStartedAt: candidate.preparationStartedAt,
        preparationFinishedAt: candidate.preparationFinishedAt,
      },
    });
    const execution = await repository.createOrReuseProviderExecution(
      candidate.id,
      { testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION },
    );
    await repository.startExecution(execution.id);
    await repository.completeExecution(execution.id, "passed", {
      failureCode: null,
      checks: [],
    });

    await prisma.report.create({
      data: {
        id: "a0000000-0000-4000-8000-000000000123",
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
      },
    });

    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T02:00:00.000Z"),
        {
          mode: "prepared",
          sourceFingerprint: "prepared",
          sourceGeneration: preparedGeneration,
        },
      ),
    ).resolves.toBe(false);
    await expect(repository.getControl()).resolves.toMatchObject({
      activeConfigurationId: null,
      enabled: false,
    });
  });

  it("copies active readiness when the embedding scope is unchanged", async () => {
    const active = await revision(
      "a0000000-0000-4000-8000-000000000026",
      AiProviderLifecycle.active,
      { completed: 120, total: 120 },
    );
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000027",
      AiProviderLifecycle.validated,
    );
    await prisma.aiProviderConfiguration.update({
      where: { id: candidate.id },
      data: {
        preparationCompleted: 0,
        preparationTotal: 0,
        preparationFailed: 0,
        preparationStartedAt: null,
        preparationFinishedAt: null,
        preparationElapsedMs: 0,
        preparationSourceFingerprint: null,
        preparationSourceGeneration: null,
      },
    });
    await createControl(active.id, true);
    const execution = await repository.createOrReuseProviderExecution(
      candidate.id,
      { testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION },
    );
    await repository.startExecution(execution.id);
    await repository.completeExecution(execution.id, "passed", {
      failureCode: null,
      checks: [],
    });
    const readiness = {
      mode: "reuse_active_scope" as const,
      activeRevisionId: active.id,
      sourceFingerprint: "prepared",
      sourceGeneration: 0n,
    };

    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T01:30:00.000Z"),
        { ...readiness, activeRevisionId: candidate.id },
      ),
    ).resolves.toBe(false);
    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T01:31:00.000Z"),
        readiness,
      ),
    ).resolves.toBe(false);

    await prisma.aiProviderConfiguration.update({
      where: { id: candidate.id },
      data: { embeddingScopeIdentity: active.embeddingScopeIdentity },
    });
    await prisma.aiProviderConfiguration.update({
      where: { id: active.id },
      data: { preparationFinishedAt: null },
    });
    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T01:32:00.000Z"),
        readiness,
      ),
    ).resolves.toBe(false);
    await prisma.aiProviderConfiguration.update({
      where: { id: active.id },
      data: { preparationFinishedAt: active.preparationFinishedAt },
    });
    await expect(repository.getControl()).resolves.toMatchObject({
      enabled: true,
      activeConfigurationId: active.id,
      activeConfiguration: { id: active.id, lifecycle: "active" },
    });

    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T02:00:00.000Z"),
        readiness,
      ),
    ).resolves.toBe(true);

    await expect(
      prisma.aiProviderConfiguration.findUnique({
        where: { id: candidate.id },
        select: {
          lifecycle: true,
          preparationCompleted: true,
          preparationTotal: true,
          preparationFailed: true,
          preparationStartedAt: true,
          preparationFinishedAt: true,
          preparationElapsedMs: true,
          preparationSourceFingerprint: true,
          preparationSourceGeneration: true,
        },
      }),
    ).resolves.toEqual({
      lifecycle: AiProviderLifecycle.active,
      preparationCompleted: active.preparationCompleted,
      preparationTotal: active.preparationTotal,
      preparationFailed: active.preparationFailed,
      preparationStartedAt: active.preparationStartedAt,
      preparationFinishedAt: active.preparationFinishedAt,
      preparationElapsedMs: active.preparationElapsedMs,
      preparationSourceFingerprint: active.preparationSourceFingerprint,
      preparationSourceGeneration: active.preparationSourceGeneration,
    });
    await expect(repository.getControl()).resolves.toMatchObject({
      enabled: true,
      activeConfigurationId: candidate.id,
      activeConfiguration: { id: candidate.id, lifecycle: "active" },
    });
  });

  it("activates an unchanged scope after report sources advance", async () => {
    const active = await revision(
      "a0000000-0000-4000-8000-000000000028",
      AiProviderLifecycle.active,
      { completed: 120, total: 120 },
    );
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000029",
      AiProviderLifecycle.validated,
    );
    await prisma.aiProviderConfiguration.update({
      where: { id: candidate.id },
      data: { embeddingScopeIdentity: active.embeddingScopeIdentity },
    });
    await createControl(active.id, true);
    const execution = await repository.createOrReuseProviderExecution(
      candidate.id,
      { testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION },
    );
    await repository.startExecution(execution.id);
    await repository.completeExecution(execution.id, "passed", {
      failureCode: null,
      checks: [],
    });
    await prisma.semanticSourceState.update({
      where: { id: "singleton" },
      data: { generation: { increment: 1 } },
    });

    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T02:00:00.000Z"),
        {
          mode: "reuse_active_scope",
          activeRevisionId: active.id,
          sourceFingerprint: "prepared",
          sourceGeneration: 0n,
        },
      ),
    ).resolves.toBe(true);
    await expect(repository.getControl()).resolves.toMatchObject({
      enabled: true,
      activeConfigurationId: candidate.id,
      activeConfiguration: { id: candidate.id, lifecycle: "active" },
    });
    await expect(
      prisma.aiProviderConfiguration.findUnique({
        where: { id: candidate.id },
        select: {
          lifecycle: true,
          preparationSourceFingerprint: true,
          preparationSourceGeneration: true,
        },
      }),
    ).resolves.toEqual({
      lifecycle: AiProviderLifecycle.active,
      preparationSourceFingerprint: "prepared",
      preparationSourceGeneration: 0n,
    });
  });

  it("keeps revision evidence and execution identity on the latest provider-test claim", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000026",
      AiProviderLifecycle.draft,
    );
    const execution = await repository.createOrReuseProviderExecution(
      candidate.id,
      { testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION },
    );
    const latest = {
      result: passingTestResult,
      status: "passed" as const,
      embeddingDimensions: 3,
      testedAt: new Date("2026-08-11T00:00:02.000Z"),
      currentLifecycle: AiProviderLifecycle.draft,
      generationCompatibilityIdentity: "generation-attempt-2",
      embeddingScopeIdentity: "embedding-attempt-2",
      compositeTestIdentity: "composite-attempt-2",
    };
    await expect(repository.startExecution(execution.id, 1)).resolves.toBe(
      true,
    );
    await expect(repository.startExecution(execution.id, 2)).resolves.toBe(
      true,
    );
    await expect(
      repository.setClaimedTestResult({
        ...latest,
        executionId: execution.id,
        executionAttempt: 2,
        id: candidate.id,
        outcome: "passed",
        failureCode: null,
        checks: [],
      }),
    ).resolves.toEqual(expect.objectContaining({ id: candidate.id }));
    await expect(
      repository.setClaimedTestResult({
        ...latest,
        executionId: execution.id,
        executionAttempt: 1,
        id: candidate.id,
        result: { ...passingTestResult, status: "failed" },
        status: "failed",
        embeddingDimensions: null,
        testedAt: new Date("2026-08-11T00:00:03.000Z"),
        outcome: "incompatible",
        failureCode: null,
        checks: [],
        compositeTestIdentity: "composite-attempt-1",
      }),
    ).resolves.toBeNull();
    await expect(repository.startExecution(execution.id, 3)).resolves.toBe(
      false,
    );
    await expect(
      prisma.aiProviderConfiguration.findUnique({
        where: { id: candidate.id },
        select: { testResult: true, compositeTestIdentity: true },
      }),
    ).resolves.toEqual({
      testResult: passingTestResult,
      compositeTestIdentity: "composite-attempt-2",
    });
    const storedExecution = await prisma.aiProviderTestExecution.findUnique({
      where: { id: execution.id },
      select: { identity: true, state: true, executionAttempt: true },
    });
    expect(storedExecution).toMatchObject({
      state: "completed",
      executionAttempt: 2,
    });
    expect(storedExecution?.identity).toContain("composite-attempt-2");
  });

  it("allows only one concurrent provider activation to win the pointer race", async () => {
    const current = await revision(
      "a0000000-0000-4000-8000-000000000010",
      AiProviderLifecycle.active,
    );
    const candidateA = await revision(
      "a0000000-0000-4000-8000-000000000011",
      AiProviderLifecycle.validated,
    );
    const candidateB = await revision(
      "a0000000-0000-4000-8000-000000000012",
      AiProviderLifecycle.validated,
    );
    await createControl(current.id, true);
    await Promise.all(
      [candidateA, candidateB].map((candidate) =>
        prisma.aiProviderTestExecution.create({
          data: {
            identity: candidate.compositeTestIdentity,
            providerRevisionId: candidate.id,
            testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
            state: "completed",
            outcome: "passed",
            checks: [],
            requestedAt: new Date("2026-08-11T01:00:00.000Z"),
            startedAt: new Date("2026-08-11T01:00:01.000Z"),
            completedAt: new Date("2026-08-11T01:00:02.000Z"),
          },
        }),
      ),
    );

    const results = await Promise.all([
      repository.activateRevision(
        candidateA.id,
        new Date("2026-08-11T02:00:00.000Z"),
        {
          mode: "prepared",
          sourceFingerprint: "prepared",
          sourceGeneration: 0n,
        },
      ),
      repository.activateRevision(
        candidateB.id,
        new Date("2026-08-11T02:00:01.000Z"),
        {
          mode: "prepared",
          sourceFingerprint: "prepared",
          sourceGeneration: 0n,
        },
      ),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const control = await prisma.aiProviderControl.findUnique({
      where: { id: "singleton" },
    });
    expect([candidateA.id, candidateB.id]).toContain(
      control?.activeConfigurationId,
    );
    await expect(
      prisma.aiProviderConfiguration.count({
        where: {
          id: { in: [candidateA.id, candidateB.id] },
          lifecycle: AiProviderLifecycle.active,
        },
      }),
    ).resolves.toBe(1);
  });

  // C0976: an activation that commits between the control read and the
  // revision read must not yield a control whose active pointer and revision
  // list describe different states.
  it("reads the control and its revisions from one snapshot across an activation", async () => {
    const current = await revision(
      "a0000000-0000-4000-8000-000000000020",
      AiProviderLifecycle.active,
    );
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000021",
      AiProviderLifecycle.validated,
    );
    await createControl(current.id, true);
    await prisma.aiProviderTestExecution.create({
      data: {
        identity: candidate.compositeTestIdentity,
        providerRevisionId: candidate.id,
        testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
        state: "completed",
        outcome: "passed",
        checks: [],
        requestedAt: new Date("2026-08-11T01:00:00.000Z"),
        startedAt: new Date("2026-08-11T01:00:01.000Z"),
        completedAt: new Date("2026-08-11T01:00:02.000Z"),
      },
    });
    let reachRevisionRead!: () => void;
    const revisionReadReached = new Promise<void>((resolve) => {
      reachRevisionRead = resolve;
    });
    let releaseRevisionRead!: () => void;
    const revisionReadReleased = new Promise<void>((resolve) => {
      releaseRevisionRead = resolve;
    });
    let finishControlRead!: () => void;
    const controlReadFinished = new Promise<void>((resolve) => {
      finishControlRead = resolve;
    });
    // Test-side barrier: the control row is read first, then the revision
    // list waits until the activation below has committed.
    const pausedPrisma = prisma.$extends({
      query: {
        aiProviderControl: {
          async findUnique({ args, query }) {
            const row = await query(args);
            finishControlRead();
            return row;
          },
        },
        aiProviderConfiguration: {
          async findMany({ args, query }) {
            reachRevisionRead();
            await revisionReadReleased;
            return query(args);
          },
        },
      },
    });
    const pausedRepository = new AiProviderConfigurationRepository(
      pausedPrisma as unknown as PrismaService,
    );

    const read = pausedRepository.getControl();
    await Promise.all([revisionReadReached, controlReadFinished]);
    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T02:00:00.000Z"),
        {
          mode: "prepared",
          sourceFingerprint: "prepared",
          sourceGeneration: 0n,
        },
      ),
    ).resolves.toBeTruthy();
    releaseRevisionRead();
    const control = await read;

    const activeInList = (control?.revisions ?? [])
      .filter((entry) => entry.lifecycle === AiProviderLifecycle.active)
      .map((entry) => entry.id);
    expect(activeInList).toEqual([control?.activeConfiguration?.id]);
    expect(control?.activeConfigurationId).toBe(
      control?.activeConfiguration?.id,
    );
  });
});
