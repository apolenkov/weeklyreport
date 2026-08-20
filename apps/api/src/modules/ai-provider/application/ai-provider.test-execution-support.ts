import {
  buildCompositeTestIdentity,
  buildEmbeddingScopeIdentity,
  buildGenerationCompatibilityIdentity,
} from "../domain/provider-identities.js";
import type { ResolvedCompositeProviderProfile } from "../domain/provider-profile.js";
import type { StoredAiProviderRevision } from "../infrastructure/ai-provider.repository.js";
import { AI_PROVIDER_TEST_SUITE_VERSION } from "../infrastructure/ai-provider-test.queue.js";
import {
  AiProviderConfigurationError,
  type AiProviderServiceDependencies,
  credentialFrom,
  toSharedProfile,
} from "./ai-provider.service-support.js";

const requiredProviderValue = <Value>(value: Value | null): Value => {
  if (value === null) {
    throw new AiProviderConfigurationError(
      "Separate embedding connection is incomplete",
    );
  }
  return value;
};

export const compositeProfileFromRevision = (
  revision: StoredAiProviderRevision,
): ResolvedCompositeProviderProfile => {
  const generation = {
    profile: toSharedProfile(revision.generationProfile),
    baseUrl: revision.generationBaseUrl,
    endpointIdentity: revision.generationEndpointIdentity,
    plannerModel: revision.plannerModel,
    answerModel: revision.answerModel,
    reasoningMode: revision.reasoningMode,
    reasoningCustomValue: revision.reasoningCustomValue,
  } as const;
  const effective = {
    profile: generation.profile,
    baseUrl: generation.baseUrl,
    endpointIdentity: generation.endpointIdentity,
    model: revision.embeddingModel,
    dimensions: revision.embeddingDimensions,
    semanticInputVersion: revision.semanticInputVersion,
  } as const;
  return revision.embeddingMode === "reuse_generation"
    ? { generation, embeddings: { mode: "reuse_generation", effective } }
    : {
        generation,
        embeddings: {
          mode: "separate",
          connection: {
            profile: toSharedProfile(
              requiredProviderValue(revision.embeddingProfile),
            ),
            baseUrl: requiredProviderValue(revision.embeddingBaseUrl),
            endpointIdentity: requiredProviderValue(
              revision.embeddingEndpointIdentity,
            ),
          },
          effective: {
            ...effective,
            profile: toSharedProfile(
              requiredProviderValue(revision.embeddingProfile),
            ),
            baseUrl: requiredProviderValue(revision.embeddingBaseUrl),
            endpointIdentity: requiredProviderValue(
              revision.embeddingEndpointIdentity,
            ),
          },
        },
      };
};

export const embeddingCredentialFor = (
  dependencies: AiProviderServiceDependencies,
  revision: StoredAiProviderRevision,
  generationCredential: string,
): string =>
  revision.embeddingMode === "reuse_generation"
    ? generationCredential
    : dependencies.codec.decrypt(credentialFrom(revision, "embeddings"), {
        revisionId: revision.id,
        role: "embeddings",
      });

export const generationIdentityFor = (
  dependencies: AiProviderServiceDependencies,
  revision: StoredAiProviderRevision,
): string =>
  buildGenerationCompatibilityIdentity({
    profile: toSharedProfile(revision.generationProfile),
    endpointIdentity: revision.generationEndpointIdentity,
    credentialFingerprint: dependencies.codec.fingerprint(
      dependencies.codec.decrypt(credentialFrom(revision), {
        revisionId: revision.id,
        role: "generation",
      }),
    ),
    plannerModel: revision.plannerModel,
    answerModel: revision.answerModel,
    reasoningMode: revision.reasoningMode,
    reasoningCustomValue: revision.reasoningCustomValue,
    testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
  });

export const embeddingIdentityFor = (
  revision: StoredAiProviderRevision,
  embeddingDimensions: number | null,
): string => {
  const endpointIdentity =
    revision.embeddingMode === "reuse_generation"
      ? revision.generationEndpointIdentity
      : requiredProviderValue(revision.embeddingEndpointIdentity);
  return buildEmbeddingScopeIdentity({
    endpointIdentity,
    model: revision.embeddingModel,
    semanticInputVersion: revision.semanticInputVersion,
    dimensions: embeddingDimensions,
  });
};

export const compositeIdentityFor = (
  dependencies: AiProviderServiceDependencies,
  revision: StoredAiProviderRevision,
  generationCompatibilityIdentity: string,
): string =>
  buildCompositeTestIdentity({
    generationCompatibilityIdentity,
    embeddings:
      revision.embeddingMode === "reuse_generation"
        ? { mode: "reuse_generation", model: revision.embeddingModel }
        : {
            mode: "separate",
            profile: toSharedProfile(
              requiredProviderValue(revision.embeddingProfile),
            ),
            endpointIdentity: requiredProviderValue(
              revision.embeddingEndpointIdentity,
            ),
            model: revision.embeddingModel,
            credentialFingerprint: dependencies.codec.fingerprint(
              dependencies.codec.decrypt(
                credentialFrom(revision, "embeddings"),
                {
                  revisionId: revision.id,
                  role: "embeddings",
                },
              ),
            ),
          },
    testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
  });
