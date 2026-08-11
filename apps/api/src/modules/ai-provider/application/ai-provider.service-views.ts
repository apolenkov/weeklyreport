import {
  type AiProviderAvailabilityRead,
  aiProviderAvailabilityReadSchema,
  type AiProviderCapabilityTestResult,
  aiProviderCapabilityTestResultSchema,
  type AiProviderConfigurationRead,
  aiProviderConfigurationReadSchema,
  type AiProviderControlRead,
  aiProviderControlReadSchema,
  type AiProviderPreparationProgress,
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

export const safeRevision = (
  revision: StoredAiProviderRevision,
  codec: AesGcmCredentialCodec,
): AiProviderConfigurationRead => {
  const credentialMetadata = codec.metadata(credentialFrom(revision));
  return aiProviderConfigurationReadSchema.parse({
    id: revision.id,
    profile: toSharedProfile(revision.profile),
    lifecycle: revision.lifecycle,
    baseUrl: revision.baseUrl,
    plannerModel: revision.plannerModel,
    answerModel: revision.answerModel,
    embeddingModel: revision.embeddingModel,
    embeddingDimensions: revision.embeddingDimensions,
    semanticInputVersion: revision.semanticInputVersion,
    credentialConfigured: credentialMetadata.configured,
    credentialMaskedSuffix: credentialMetadata.maskedSuffix,
    testResult: safeTestResult(revision.testResult),
    progress: {
      completed: revision.preparationCompleted,
      total: revision.preparationTotal,
      failed: revision.preparationFailed,
      elapsedMs: revision.preparationElapsedMs,
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
    activeRevisionId: null,
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
    activeRevisionId: control.activeConfigurationId,
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
  const parsed = aiProviderCapabilityTestResultSchema.safeParse(value);
  return parsed.success && parsed.data.status === "passed";
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
): import("../domain/provider-profile.js").ResolvedProviderProfile => ({
  profile: toSharedProfile(revision.profile),
  baseUrl: revision.baseUrl,
  endpointIdentity: revision.endpointIdentity,
  plannerModel: revision.plannerModel,
  answerModel: revision.answerModel,
  embeddingModel: revision.embeddingModel,
  embeddingDimensions: requiredEmbeddingDimensions(
    revision.embeddingDimensions,
  ),
  semanticInputVersion: revision.semanticInputVersion,
});

export const requiredEmbeddingDimensions = (value: number | null): number => {
  if (value === null) {
    throw new AiProviderConfigurationError(
      "AI provider embedding dimensions have not been measured",
    );
  }
  return value;
};
