import { AiProviderLifecycle } from "@prisma/client";

import { AI_PROVIDER_TEST_SUITE_VERSION } from "../infrastructure/ai-provider-test.queue.js";
import {
  AiProviderConfigurationError,
  type AiProviderServiceDependencies,
  completeCapabilityResult,
  requireRevision,
  toSharedProfile,
} from "./ai-provider.service-support.js";

type ProviderRevision = Awaited<ReturnType<typeof requireRevision>>;
type PreparedProviderRevision = ProviderRevision &
  Readonly<{
    preparationSourceFingerprint: string;
    preparationSourceGeneration: bigint;
  }>;

export const requirePreparationEvidence = (
  dependencies: AiProviderServiceDependencies,
  profile: ReturnType<typeof toSharedProfile>,
  revision: ProviderRevision,
): PreparedProviderRevision => {
  if (
    typeof revision.preparationSourceFingerprint !== "string" ||
    revision.preparationSourceFingerprint.length === 0 ||
    typeof revision.preparationSourceGeneration !== "bigint" ||
    revision.preparationFinishedAt === null ||
    revision.preparationFailed !== 0 ||
    revision.preparationCompleted !== revision.preparationTotal
  ) {
    return failActivation(
      dependencies,
      profile,
      "Semantic preparation evidence is incomplete; activation must be retried",
    );
  }
  return revision as PreparedProviderRevision;
};

export const assertRevisionReady = (
  revision: ProviderRevision,
  allowedLifecycles: readonly AiProviderLifecycle[],
): void => {
  if (!allowedLifecycles.includes(revision.lifecycle)) {
    throw new AiProviderConfigurationError(
      "Only a validated AI provider revision can be activated",
    );
  }
  if (!completeCapabilityResult(revision.testResult)) {
    throw new AiProviderConfigurationError(
      "Current passing generation and embedding evidence is required",
    );
  }
  const execution = revision.latestExecution;
  const testSuiteVersion = execution?.testSuiteVersion;
  const state = execution?.state;
  const outcome = execution?.outcome;
  if (
    testSuiteVersion !== AI_PROVIDER_TEST_SUITE_VERSION ||
    state !== "completed" ||
    outcome !== "passed"
  ) {
    throw new AiProviderConfigurationError(
      "A current composite capability execution is required",
    );
  }
};

export const failActivation = (
  dependencies: AiProviderServiceDependencies,
  profile: ReturnType<typeof toSharedProfile>,
  message: string,
): never => {
  dependencies.metrics.recordActivation({ profile, result: "failed" });
  throw new AiProviderConfigurationError(message);
};

export const requirePreparedRevision = async (
  dependencies: AiProviderServiceDependencies,
  revisionId: string,
  profile: ReturnType<typeof toSharedProfile>,
): Promise<PreparedProviderRevision> => {
  const revision = await dependencies.repository.getRevision(revisionId);
  if (!revision) {
    return failActivation(
      dependencies,
      profile,
      "AI provider revision disappeared during activation",
    );
  }
  return requirePreparationEvidence(dependencies, profile, revision);
};

export const verifyCurrentSourceFingerprint = async (
  dependencies: AiProviderServiceDependencies,
  profile: ReturnType<typeof toSharedProfile>,
  revision: PreparedProviderRevision,
): Promise<void> => {
  const currentSourceFingerprint =
    dependencies.preparation?.currentSourceFingerprint;
  if (!currentSourceFingerprint) return;
  const current = await currentSourceFingerprint(revision);
  if (current !== revision.preparationSourceFingerprint) {
    failActivation(
      dependencies,
      profile,
      "Report sources changed after embedding preparation; activation must be retried",
    );
  }
};

export const requireOutboundApproval = (
  dependencies: AiProviderServiceDependencies,
  actorId: string,
  revision: ProviderRevision,
): void => {
  if (dependencies.env.REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED) return;
  const profile = toSharedProfile(revision.generationProfile);
  dependencies.audit.record({
    event: "ai_provider.activation_blocked_outbound_approval",
    actorId,
    revisionId: revision.id,
    profile,
  });
  failActivation(
    dependencies,
    profile,
    "Outbound report-data approval is required before AI provider activation",
  );
};
