import { AiProviderLifecycle, AiProviderProfile } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import { AiProviderConfigurationRepository } from "./ai-provider.repository.js";
import { AI_PROVIDER_TEST_SUITE_VERSION } from "./ai-provider-test.queue.js";

const prisma = createTestPrisma();
const repository = new AiProviderConfigurationRepository(
  prisma as unknown as PrismaService,
);

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

describe("AI provider execution identity collisions (database)", () => {
  beforeEach(async () => {
    await cleanDatabase();
    await prisma.semanticSourceState.create({ data: { id: "singleton" } });
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  // Synthetic stand-in for a real race: a P2002 cannot be reproduced on demand,
  // so the colliding retry identity is planted directly. The catch path must
  // rethrow the original unique violation rather than hand over another
  // suite's execution (C0956).
  it("rethrows the identity collision when the taken retry identity belongs to another suite", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-0000000000f1",
      AiProviderLifecycle.failed,
    );
    const base = `${candidate.compositeTestIdentity}:revision:${candidate.id}`;
    await prisma.aiProviderTestExecution.create({
      data: {
        identity: base,
        providerRevisionId: candidate.id,
        testSuiteVersion: "provider-test-v1",
        state: "completed",
        outcome: "passed",
        checks: [],
        requestedAt: new Date("2026-08-11T00:00:00.000Z"),
      },
    });
    await prisma.aiProviderTestExecution.create({
      data: {
        identity: `${base}:retry:2`,
        providerRevisionId: candidate.id,
        testSuiteVersion: "provider-test-v1",
        state: "completed",
        outcome: "passed",
        checks: [],
        requestedAt: new Date("2026-08-11T00:00:01.000Z"),
      },
    });

    await expect(
      repository.createOrReuseProviderExecution(candidate.id, {
        testSuiteVersion: "provider-test-v2",
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.aiProviderTestExecution.count({
        where: { providerRevisionId: candidate.id },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.aiProviderTestExecution.count({
        where: {
          providerRevisionId: candidate.id,
          testSuiteVersion: "provider-test-v2",
        },
      }),
    ).resolves.toBe(0);
  });

  // Invariant under concurrency (any interleaving): each returned execution
  // carries the version it was requested with, identities stay unique, and at
  // most two rows exist. A P2002 loser is an allowed outcome.
  it("keeps concurrent requests for different suite versions on their own rows", async () => {
    const requested = ["provider-test-v1", "provider-test-v2"] as const;
    for (let run = 0; run < 5; run += 1) {
      const candidate = await revision(
        `a0000000-0000-4000-8000-00000000040${run}`,
        AiProviderLifecycle.failed,
      );
      const settled = await Promise.allSettled(
        requested.map((testSuiteVersion) =>
          repository.createOrReuseProviderExecution(candidate.id, {
            testSuiteVersion,
          }),
        ),
      );
      for (const [index, result] of settled.entries()) {
        if (result.status === "rejected") {
          expect(result.reason).toMatchObject({ code: "P2002" });
          continue;
        }
        const row = await prisma.aiProviderTestExecution.findUnique({
          where: { id: result.value.id },
        });
        expect(row?.testSuiteVersion).toBe(requested[index]);
      }
      const rows = await prisma.aiProviderTestExecution.findMany({
        where: { providerRevisionId: candidate.id },
        select: { identity: true },
      });
      expect(rows.length).toBeLessThanOrEqual(2);
      expect(new Set(rows.map((row) => row.identity)).size).toBe(rows.length);
    }
  });

  it("returns one shared execution to concurrent requests for the same suite", async () => {
    const candidate = await revision(
      "a0000000-0000-4000-8000-000000000300",
      AiProviderLifecycle.failed,
    );
    const request = { testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION };

    const [first, second] = await Promise.all([
      repository.createOrReuseProviderExecution(candidate.id, request),
      repository.createOrReuseProviderExecution(candidate.id, request),
    ]);

    expect(second.id).toBe(first.id);
    await expect(
      prisma.aiProviderTestExecution.count({
        where: { providerRevisionId: candidate.id },
      }),
    ).resolves.toBe(1);
  });
});
