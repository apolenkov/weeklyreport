import type { AiProviderConfigurationRead } from "@customreport/shared";

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
  const capabilityPassed = completeCapabilityResult(test.result);
  const embeddingDimensions = capabilityPassed
    ? (test.embeddingDimensions ?? revision.embeddingDimensions)
    : null;
  const generationCompatibilityIdentity = generationIdentityFor(
    dependencies,
    revision,
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
  const providerStatus = capabilityResultStatus(test.result);
  if (!providerStatus) throw new Error("Provider capability result is invalid");
  const status = providerStatus;
  const result = { ...resultObjectFrom(test.result), status };
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
