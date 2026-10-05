import {
  AI_PROVIDER_PROFILE_CAPABILITIES,
  type AiProviderAvailabilityRead,
  aiProviderAvailabilityReadSchema,
  type AiProviderCapabilityTestResult,
  aiProviderCapabilityTestResultSchema,
  type AiProviderConfigurationRead,
  aiProviderConfigurationReadSchema,
  type AiProviderControlRead,
  aiProviderControlReadSchema,
  type AiProviderPreparationProgress,
  type AiProviderTestExecutionRead,
  aiProviderTestExecutionReadSchema,
} from "@customreport/shared";
import { AiProviderLifecycle, type Prisma } from "@prisma/client";

import type {
  StoredAiProviderControl,
  StoredAiProviderRevision,
} from "../infrastructure/ai-provider.repository.js";
import type { AesGcmCredentialCodec } from "../infrastructure/credential-codec.js";
import {
  AiProviderConfigurationError,
  AiProviderNotFoundError,
  type AiProviderServiceDependencies,
  credentialFrom,
  toSharedProfile,
} from "./ai-provider.service-types.js";

const safeTestResult = (
  value: Prisma.JsonValue | null,
): AiProviderCapabilityTestResult | null => {
  const parsed = aiProviderCapabilityTestResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const executionRead = (
  revision: StoredAiProviderRevision,
): AiProviderTestExecutionRead | null => {
  const execution = revision.latestExecution;
  if (!execution) return null;
  return aiProviderTestExecutionReadSchema.parse({
    ...execution,
    checks: execution.checks ?? [],
  });
};

export const safeRevision = (
  revision: StoredAiProviderRevision,
  codec: AesGcmCredentialCodec,
): AiProviderConfigurationRead => {
  const generationCredential = codec.metadata(credentialFrom(revision));
  return aiProviderConfigurationReadSchema.parse({
    id: revision.id,
    lifecycle: revision.lifecycle,
    generation: {
      profile: toSharedProfile(revision.generationProfile),
      baseUrl: revision.generationBaseUrl,
      plannerModel: revision.plannerModel,
      answerModel: revision.answerModel,
      reasoningMode: revision.reasoningMode,
      reasoningCustomValue: revision.reasoningCustomValue,
      credentialConfigured: generationCredential.configured,
      credentialMaskedSuffix: generationCredential.maskedSuffix,
    },
    embeddings:
      revision.embeddingMode === "reuse_generation"
        ? {
            mode: "reuse_generation",
            model: revision.embeddingModel,
            dimensions: revision.embeddingDimensions,
          }
        : {
            mode: "separate",
            profile: toSharedProfile(
              requiredEmbeddingValue(revision.embeddingProfile),
            ),
            baseUrl: requiredEmbeddingValue(revision.embeddingBaseUrl),
            model: revision.embeddingModel,
            dimensions: revision.embeddingDimensions,
            credentialConfigured: true,
            credentialMaskedSuffix: codec.metadata(
              credentialFrom(revision, "embeddings"),
            ).maskedSuffix,
          },
    generationCompatibilityIdentity: revision.generationCompatibilityIdentity,
    semanticInputVersion: revision.semanticInputVersion,
    testResult: safeTestResult(revision.testResult),
    latestExecution: executionRead(revision),
    progress: {
      completed: revision.preparationCompleted,
      total: revision.preparationTotal,
      failed: revision.preparationFailed,
      elapsedMs: revision.preparationElapsedMs,
      finishedAt: revision.preparationFinishedAt,
    },
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
    activatedAt: revision.activatedAt,
  });
};

export const emptyControl = (): AiProviderControlRead =>
  aiProviderControlReadSchema.parse({
    enabled: false,
    availability: "not_configured",
    runtimeFailure: null,
    activeRevisionId: null,
    profileCapabilities: AI_PROVIDER_PROFILE_CAPABILITIES,
    active: null,
    revisions: [],
  });

export const toControl = (
  control: StoredAiProviderControl,
  codec: AesGcmCredentialCodec,
): AiProviderControlRead =>
  aiProviderControlReadSchema.parse({
    enabled: control.enabled,
    availability:
      control.enabled &&
      control.activeConfiguration?.lifecycle === AiProviderLifecycle.active
        ? "available"
        : "not_configured",
    runtimeFailure: null,
    activeRevisionId: control.activeConfigurationId,
    profileCapabilities: AI_PROVIDER_PROFILE_CAPABILITIES,
    active: control.activeConfiguration
      ? safeRevision(control.activeConfiguration, codec)
      : null,
    revisions: control.revisions.map((revision) =>
      safeRevision(revision, codec),
    ),
  });

export const availabilityOf = (
  control: AiProviderControlRead,
): AiProviderAvailabilityRead =>
  aiProviderAvailabilityReadSchema.parse({
    availability: control.availability,
  });

export const progressOf = (
  revision: StoredAiProviderRevision,
): AiProviderPreparationProgress => ({
  revisionId: revision.id,
  completed: revision.preparationCompleted,
  total: revision.preparationTotal,
  failed: revision.preparationFailed,
  elapsedMs: revision.preparationElapsedMs,
  startedAt: revision.preparationStartedAt,
  finishedAt: revision.preparationFinishedAt,
});

export const completeCapabilityResult = (value: Prisma.JsonValue): boolean => {
  return capabilityResultStatus(value) === "passed";
};

export const capabilityResultStatus = (
  value: Prisma.JsonValue,
): AiProviderCapabilityTestResult["status"] | null => {
  const parsed = aiProviderCapabilityTestResultSchema.safeParse(value);
  return parsed.success ? parsed.data.status : null;
};

export const requireRevision = async (
  dependencies: AiProviderServiceDependencies,
  id: string,
): Promise<StoredAiProviderRevision> => {
  const revision = await dependencies.repository.getRevision(id);
  if (!revision) throw new AiProviderNotFoundError();
  return revision;
};

export const resolveProfileFromRevision = (
  revision: StoredAiProviderRevision,
): import("../domain/provider-profile.js").ResolvedEmbeddingProfile => ({
  profile:
    revision.embeddingMode === "reuse_generation"
      ? toSharedProfile(revision.generationProfile)
      : toSharedProfile(requiredEmbeddingValue(revision.embeddingProfile)),
  baseUrl:
    revision.embeddingMode === "reuse_generation"
      ? revision.generationBaseUrl
      : requiredEmbeddingValue(revision.embeddingBaseUrl),
  endpointIdentity:
    revision.embeddingMode === "reuse_generation"
      ? revision.generationEndpointIdentity
      : requiredEmbeddingValue(revision.embeddingEndpointIdentity),
  model: revision.embeddingModel,
  dimensions: requiredEmbeddingDimensions(revision.embeddingDimensions),
  semanticInputVersion: revision.semanticInputVersion,
});

const requiredEmbeddingValue = <Value>(value: Value | null): Value => {
  if (value === null) {
    throw new AiProviderConfigurationError(
      "Separate embedding connection is incomplete",
    );
  }
  return value;
};

const requiredEmbeddingDimensions = (value: number | null): number => {
  if (value === null) {
    throw new AiProviderConfigurationError(
      "AI provider embedding dimensions have not been measured",
    );
  }
  return value;
};
