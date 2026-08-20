import { AiProviderLifecycle, AiProviderProfile } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import { AiProviderConfigurationService } from "../application/ai-provider.service.js";
import type { AiProviderEnvironment } from "../application/ai-provider.service-types.js";
import { AiProviderConfigurationRepository } from "./ai-provider.repository.js";
import { AesGcmCredentialCodec } from "./credential-codec.js";

const prisma = createTestPrisma();
const repository = new AiProviderConfigurationRepository(
  prisma as unknown as PrismaService,
);
const discardEnvironment = {
  AI_PROVIDER_ALLOWED_ORIGINS: "https://api.mistral.ai",
  REPORT_ASSISTANT_INPUT_VERSION: "report-assistant/v1",
  MISTRAL_API_KEY: undefined,
  MISTRAL_PLANNER_MODEL: undefined,
  MISTRAL_ANSWER_MODEL: undefined,
  MISTRAL_EMBEDDING_MODEL: undefined,
  MISTRAL_EMBEDDING_DIMENSIONS: undefined,
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
      preparationElapsedMs: 25,
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
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
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
    const events: Record<string, string | number | null>[] = [];
    const service = new AiProviderConfigurationService(
      repository,
      discardCodec,
      discardEnvironment,
      undefined,
      undefined,
      { record: (event) => events.push({ ...event }) },
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

  it("round-trips bootstrapped, preparing, failed, and superseded revisions", async () => {
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

    await repository.setTestResult(
      candidate.id,
      {
        status: "passed",
        generation: {
          status: "passed",
          capabilities: [{ capability: "structured_answer", status: "passed" }],
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: testedAt.toISOString(),
      },
      "passed",
      3,
      testedAt,
      AiProviderLifecycle.draft,
    );

    await expect(
      prisma.aiProviderConfiguration.findUnique({
        where: { id: candidate.id },
        select: { testResult: true },
      }),
    ).resolves.toMatchObject({
      testResult: { generation: { status: "passed" } },
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
        testSuiteVersion: "provider-test-v1",
      };
      const first = await repository.createOrReuseProviderExecution(
        candidate.id,
        request,
      );
      await repository.startExecution(first.id);
      const checkOutcome =
        terminalOutcome === "incompatible" ? "failed" : "inconclusive";
      await repository.completeExecution(
        first.id,
        terminalOutcome,
        terminalOutcome === "inconclusive"
          ? "provider_transient_failure"
          : null,
        [
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
      );

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
    const request = { testSuiteVersion: "provider-test-v1" };
    const previousExecution = await repository.createOrReuseProviderExecution(
      previous.id,
      request,
    );
    await repository.completeExecution(
      previousExecution.id,
      "configuration_error",
      "provider_authentication_failed",
      [],
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
      { testSuiteVersion: "provider-test-v1" },
    );
    await repository.startExecution(execution.id);
    await repository.completeExecution(execution.id, "passed", null, []);

    await expect(
      repository.activateRevision(
        candidate.id,
        new Date("2026-08-11T02:00:00.000Z"),
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
            testSuiteVersion: "provider-test-v1",
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
      ),
      repository.activateRevision(
        candidateB.id,
        new Date("2026-08-11T02:00:01.000Z"),
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
});
