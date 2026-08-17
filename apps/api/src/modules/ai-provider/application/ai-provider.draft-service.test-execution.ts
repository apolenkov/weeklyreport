import type { AiProviderConfigurationRead } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  type AiProviderServiceDependencies,
  capabilityResultStatus,
  completeCapabilityResult,
  now,
  requireRevision,
  safeRevision,
  toSharedProfile,
} from "./ai-provider.service-support.js";
import {
  compositeIdentityFor,
  compositeProfileFromRevision,
  embeddingCredentialFor,
  embeddingIdentityFor,
  generationIdentityFor,
} from "./ai-provider.test-execution-support.js";

const resultObjectFrom = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

const withAnswerProtocol = (
  result: Record<string, unknown>,
  answerProtocol: string | null,
): Record<string, unknown> => {
  const generation = result.generation;
  const generationResult =
    typeof generation === "object" &&
    generation !== null &&
    !Array.isArray(generation)
      ? (generation as Record<string, unknown>)
      : {};
  return {
    ...result,
    generation: { ...generationResult, answerProtocol },
  };
};

export const executeAiProviderTest = async (
  dependencies: AiProviderServiceDependencies,
  revisionId: string,
  actorId = "worker",
  executionId?: string,
): Promise<AiProviderConfigurationRead> => {
  const revision = await requireRevision(dependencies, revisionId);
  const tester = dependencies.tester;
  if (!tester) throw new Error("AI provider capability tester is not wired");
  const profile = compositeProfileFromRevision(revision);
  const generationCredential = dependencies.codec.decrypt(
    {
      ciphertext: revision.generationCredentialCiphertext,
      nonce: revision.generationCredentialNonce,
      tag: revision.generationCredentialTag,
      keyVersion: revision.generationCredentialKeyVersion,
      maskedSuffix: revision.generationCredentialMaskedSuffix,
    },
    { revisionId: revision.id, role: "generation" },
  );
  const test = await tester.test(
    profile,
    {
      generation: generationCredential,
      embeddings: embeddingCredentialFor(
        dependencies,
        revision,
        generationCredential,
      ),
    },
    {
      reasoningMode: revision.reasoningMode,
      reasoningCustomValue: revision.reasoningCustomValue,
    },
  );
  const answerProtocol = test.answerProtocol ?? revision.answerProtocol;
  const resultWithProtocol = withAnswerProtocol(
    resultObjectFrom(test.result),
    answerProtocol,
  );
  const capabilityPassed = completeCapabilityResult(
    resultWithProtocol as Prisma.JsonValue,
  );
  const embeddingDimensions = capabilityPassed
    ? (test.embeddingDimensions ?? revision.embeddingDimensions)
    : null;
  const generationCompatibilityIdentity = generationIdentityFor(
    dependencies,
    revision,
    answerProtocol,
  );
  const embeddingScopeIdentity = embeddingIdentityFor(
    revision,
    embeddingDimensions,
  );
  const compositeTestIdentity = compositeIdentityFor(
    dependencies,
    revision,
    generationCompatibilityIdentity,
  );
  const providerStatus = capabilityResultStatus(
    resultWithProtocol as Prisma.JsonValue,
  );
  if (!providerStatus) throw new Error("Provider capability result is invalid");
  const status = providerStatus;
  const result = { ...resultWithProtocol, status };
  const tested = await dependencies.repository.setTestResult(
    revisionId,
    result,
    status,
    embeddingDimensions,
    now(),
    revision.lifecycle,
    {
      generationCompatibilityIdentity,
      embeddingScopeIdentity,
      compositeTestIdentity,
    },
  );
  if (executionId) {
    await dependencies.repository.updateExecutionIdentity(
      executionId,
      compositeTestIdentity,
      revisionId,
    );
  }
  dependencies.audit.record({
    event: "ai_provider.tested",
    actorId,
    revisionId,
    profile: toSharedProfile(revision.generationProfile),
    result: status,
  });
  dependencies.metrics.recordCapabilityTest({
    profile: toSharedProfile(revision.generationProfile),
    result: status,
  });
  return safeRevision(tested, dependencies.codec);
};
