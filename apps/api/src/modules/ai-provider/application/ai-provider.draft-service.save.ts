import { randomUUID } from "node:crypto";

import {
  type AiProviderConfigurationRead,
  type AiProviderDraft,
  aiProviderDraftSchema,
} from "@customreport/shared";

import {
  buildCompositeTestIdentity,
  buildEmbeddingScopeIdentity,
  buildGenerationCompatibilityIdentity,
} from "../domain/provider-identities.js";
import { resolveProviderProfile } from "../domain/provider-profile.js";
import type {
  NewAiProviderRevision,
  StoredAiProviderRevision,
} from "../infrastructure/ai-provider.repository.js";
import { AI_PROVIDER_TEST_SUITE_VERSION } from "../infrastructure/ai-provider-test.queue.js";
import type { AesGcmCredentialCodec } from "../infrastructure/credential-codec.js";
import {
  AiProviderConfigurationError,
  type AiProviderServiceDependencies,
  credentialFrom,
  safeRevision,
  toPrismaProfile,
} from "./ai-provider.service-support.js";

const GENERATION_ROLE = "generation" as const;
const EMBEDDINGS_ROLE = "embeddings" as const;
const EMBEDDING_CREDENTIAL_REQUIRED_MESSAGE =
  "An embedding credential is required when its connection changes";

const retainCredential = (
  codec: AesGcmCredentialCodec,
  revision: StoredAiProviderRevision,
  role: typeof GENERATION_ROLE | typeof EMBEDDINGS_ROLE,
  revisionId: string,
) =>
  codec.encrypt(
    codec.decrypt(credentialFrom(revision, role), {
      revisionId: revision.id,
      role,
    }),
    { revisionId, role },
  );

const retainedOrNewCredential = (
  dependencies: AiProviderServiceDependencies,
  credential: string | undefined,
  active: StoredAiProviderRevision | null,
  profileMatches: boolean,
  role: typeof GENERATION_ROLE | typeof EMBEDDINGS_ROLE,
  revisionId: string,
) =>
  credential
    ? dependencies.codec.encrypt(credential, { revisionId, role })
    : active && profileMatches
      ? retainCredential(dependencies.codec, active, role, revisionId)
      : undefined;

const requireCredential = <Credential>(
  credential: Credential | null | undefined,
  message: string,
): Credential => {
  if (!credential) throw new AiProviderConfigurationError(message);
  return credential;
};

const credentialSourceFor = async (
  dependencies: AiProviderServiceDependencies,
  baseRevisionId: string | undefined,
  active: StoredAiProviderRevision | null,
): Promise<StoredAiProviderRevision | null> => {
  if (!baseRevisionId) return active;
  const source = await dependencies.repository.getRevision(baseRevisionId);
  if (!source) {
    throw new AiProviderConfigurationError(
      "The provider revision selected for credential retention no longer exists",
    );
  }
  return source;
};

export const saveAiProviderDraft = async (
  dependencies: AiProviderServiceDependencies,
  input: AiProviderDraft,
  actorId: string,
): Promise<AiProviderConfigurationRead> => {
  const draft = aiProviderDraftSchema.parse(input);
  const profile = resolveProviderProfile(
    draft,
    dependencies.env.AI_PROVIDER_ALLOWED_ORIGINS,
    dependencies.env.REPORT_ASSISTANT_INPUT_VERSION,
  );
  const revisionId = randomUUID();
  const control = await dependencies.repository.getControl();
  const active = control?.activeConfiguration ?? null;
  const credentialSource = await credentialSourceFor(
    dependencies,
    draft.baseRevisionId,
    active,
  );
  const separateEmbeddings =
    profile.embeddings.mode === "separate" ? profile.embeddings : null;
  const embeddingCredentialInput =
    draft.embeddings.mode === "separate"
      ? draft.embeddings.credential
      : undefined;
  const generationCredential = retainedOrNewCredential(
    dependencies,
    draft.generation.credential,
    credentialSource,
    credentialSource?.generationProfile ===
      toPrismaProfile(profile.generation.profile) &&
      credentialSource.generationEndpointIdentity ===
        profile.generation.endpointIdentity,
    GENERATION_ROLE,
    revisionId,
  );
  const persistedGenerationCredential = requireCredential(
    generationCredential,
    "A generation credential is required when its connection changes",
  );
  const embeddingCredential = separateEmbeddings
    ? retainedOrNewCredential(
        dependencies,
        embeddingCredentialInput,
        credentialSource,
        credentialSource?.embeddingMode === "separate" &&
          credentialSource.embeddingProfile ===
            toPrismaProfile(separateEmbeddings.connection.profile) &&
          credentialSource.embeddingEndpointIdentity ===
            separateEmbeddings.connection.endpointIdentity,
        EMBEDDINGS_ROLE,
        revisionId,
      )
    : null;
  const persistedEmbeddingCredential = separateEmbeddings
    ? requireCredential(
        embeddingCredential,
        EMBEDDING_CREDENTIAL_REQUIRED_MESSAGE,
      )
    : null;
  const generationCredentialValue = dependencies.codec.decrypt(
    persistedGenerationCredential,
    { revisionId, role: GENERATION_ROLE },
  );
  const generationCompatibilityIdentity = buildGenerationCompatibilityIdentity({
    profile: profile.generation.profile,
    endpointIdentity: profile.generation.endpointIdentity,
    credentialFingerprint: dependencies.codec.fingerprint(
      generationCredentialValue,
    ),
    plannerModel: profile.generation.plannerModel,
    answerModel: profile.generation.answerModel,
    reasoningMode: profile.generation.reasoningMode,
    reasoningCustomValue: profile.generation.reasoningCustomValue,
    testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
  });
  const embeddingScopeIdentity = buildEmbeddingScopeIdentity({
    endpointIdentity: profile.embeddings.effective.endpointIdentity,
    model: profile.embeddings.effective.model,
    semanticInputVersion: profile.embeddings.effective.semanticInputVersion,
    dimensions: profile.embeddings.effective.dimensions,
  });
  const compositeTestIdentity = buildCompositeTestIdentity({
    generationCompatibilityIdentity,
    embeddings:
      profile.embeddings.mode === "reuse_generation"
        ? {
            mode: profile.embeddings.mode,
            model: profile.embeddings.effective.model,
          }
        : {
            mode: profile.embeddings.mode,
            profile: profile.embeddings.connection.profile,
            endpointIdentity: profile.embeddings.effective.endpointIdentity,
            model: profile.embeddings.effective.model,
            credentialFingerprint: dependencies.codec.fingerprint(
              dependencies.codec.decrypt(
                requireCredential(
                  persistedEmbeddingCredential,
                  EMBEDDING_CREDENTIAL_REQUIRED_MESSAGE,
                ),
                {
                  revisionId,
                  role: EMBEDDINGS_ROLE,
                },
              ),
            ),
          },
    testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
  });
  const revision = await dependencies.repository.createDraft({
    id: revisionId,
    generation: {
      profile: toPrismaProfile(profile.generation.profile),
      baseUrl: profile.generation.baseUrl,
      endpointIdentity: profile.generation.endpointIdentity,
      credential: persistedGenerationCredential,
    },
    plannerModel: profile.generation.plannerModel,
    answerModel: profile.generation.answerModel,
    reasoningMode: profile.generation.reasoningMode,
    reasoningCustomValue: profile.generation.reasoningCustomValue,
    embeddings:
      profile.embeddings.mode === "reuse_generation"
        ? {
            mode: "reuse_generation",
            model: profile.embeddings.effective.model,
            dimensions: null,
            semanticInputVersion:
              profile.embeddings.effective.semanticInputVersion,
          }
        : {
            mode: "separate",
            profile: toPrismaProfile(profile.embeddings.connection.profile),
            baseUrl: profile.embeddings.connection.baseUrl,
            endpointIdentity: profile.embeddings.connection.endpointIdentity,
            model: profile.embeddings.effective.model,
            dimensions: null,
            semanticInputVersion:
              profile.embeddings.effective.semanticInputVersion,
            credential: requireCredential(
              persistedEmbeddingCredential,
              EMBEDDING_CREDENTIAL_REQUIRED_MESSAGE,
            ),
          },
    generationCompatibilityIdentity,
    embeddingScopeIdentity,
    compositeTestIdentity,
  } satisfies NewAiProviderRevision);
  dependencies.audit.record({
    event: "ai_provider.draft_saved",
    actorId,
    revisionId: revision.id,
    generationProfile: draft.generation.profile,
    embeddingMode: draft.embeddings.mode,
  });
  return safeRevision(revision, dependencies.codec);
};
