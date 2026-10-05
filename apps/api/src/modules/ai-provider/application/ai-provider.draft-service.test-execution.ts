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
import type { AiProviderExecutionClaim } from "./ai-provider.service-types.js";
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

const runProviderTest = (
  dependencies: AiProviderServiceDependencies,
  tester: NonNullable<AiProviderServiceDependencies["tester"]>,
  revision: Awaited<ReturnType<typeof requireRevision>>,
) => {
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
  return tester.test(
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
};

type TestResultRecord = Parameters<
  AiProviderServiceDependencies["repository"]["setTestResult"]
>[0];

const persistTestResult = (
  dependencies: AiProviderServiceDependencies,
  executionClaim: AiProviderExecutionClaim | undefined,
  record: TestResultRecord,
) => {
  if (!executionClaim) return dependencies.repository.setTestResult(record);
  const { status } = record;
  const outcome =
    status === "passed"
      ? ("passed" as const)
      : status === "inconclusive"
        ? ("inconclusive" as const)
        : ("incompatible" as const);
  return dependencies.repository.setClaimedTestResult({
    ...record,
    executionId: executionClaim.id,
    executionAttempt: executionClaim.attempt,
    outcome,
    failureCode: null,
    checks: providerChecksFor(record.result as Record<string, unknown>),
  });
};

export const executeAiProviderTest = async (
  dependencies: AiProviderServiceDependencies,
  revisionId: string,
  actorId = "worker",
  executionClaim?: AiProviderExecutionClaim,
): Promise<AiProviderConfigurationRead> => {
  const revision = await requireRevision(dependencies, revisionId);
  const tester = dependencies.tester;
  if (!tester) throw new Error("AI provider capability tester is not wired");
  const test = await runProviderTest(dependencies, tester, revision);
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
  const tested = await persistTestResult(dependencies, executionClaim, {
    id: revisionId,
    result,
    status,
    embeddingDimensions,
    testedAt: now(),
    currentLifecycle: revision.lifecycle,
    generationCompatibilityIdentity,
    embeddingScopeIdentity,
    compositeTestIdentity,
  });
  if (!tested) {
    const current = await requireRevision(dependencies, revisionId);
    return safeRevision(current, dependencies.codec);
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

export const providerChecksFor = (result: Record<string, unknown>) =>
  ["generation", "embeddings"].flatMap((lane) => {
    const value = result[lane];
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const capabilities = (value as Record<string, unknown>).capabilities;
    if (!Array.isArray(capabilities)) return [];
    return capabilities.flatMap((capability) => {
      if (
        !capability ||
        typeof capability !== "object" ||
        Array.isArray(capability)
      ) {
        return [];
      }
      const item = capability as Record<string, unknown>;
      if (
        typeof item.capability !== "string" ||
        typeof item.status !== "string"
      ) {
        return [];
      }
      const passed = item.status === "passed";
      return [
        {
          code: `${lane}.${item.capability}`,
          // A failed capability is an incompatible check in the persisted
          // contract; only passed/inconclusive map through unchanged.
          outcome: passed
            ? "passed"
            : item.status === "inconclusive"
              ? "inconclusive"
              : "incompatible",
          passedCount: passed ? 1 : 0,
          failedCount: passed ? 0 : 1,
        },
      ];
    });
  });
