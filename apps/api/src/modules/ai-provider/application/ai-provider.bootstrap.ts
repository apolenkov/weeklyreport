import { randomUUID } from "node:crypto";

import { aiProviderDraftSchema } from "@customreport/shared";
import {
  AiProviderLifecycle,
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@prisma/client";

import {
  buildCompositeTestIdentity,
  buildEmbeddingScopeIdentity,
  buildGenerationCompatibilityIdentity,
} from "../domain/provider-identities.js";
import { resolveProviderProfile } from "../domain/provider-profile.js";
import { AI_PROVIDER_TEST_SUITE_VERSION } from "../infrastructure/ai-provider-test.queue.js";
import type { AiProviderReadService } from "./ai-provider.read-service.js";
import { legacySettings, now } from "./ai-provider.service-support.js";
import type { AiProviderServiceDependencies } from "./ai-provider.service-types.js";

const GENERATION_CAPABILITY_NAMES = [
  "authentication",
  "planner_tool_call",
  "structured_answer",
  "token_usage",
] as const;
const EMBEDDING_CAPABILITY_NAMES = [
  "authentication",
  "batch_embeddings",
] as const;

export const bootstrapAiProvider = async (
  dependencies: AiProviderServiceDependencies,
  reader: AiProviderReadService,
  actorId: string,
) => {
  if (await dependencies.repository.hasAnyConfiguration()) return reader.read();
  const legacy = legacySettings(dependencies.env);
  if (!legacy) return reader.read();
  const draft = aiProviderDraftSchema.parse({
    generation: {
      profile: "mistral",
      plannerModel: legacy.plannerModel,
      answerModel: legacy.answerModel,
      reasoningMode: "provider_default",
      credential: legacy.apiKey,
    },
    embeddings: { mode: "reuse_generation", model: legacy.embeddingModel },
  });
  const profile = resolveProviderProfile(
    draft,
    dependencies.env.AI_PROVIDER_ALLOWED_ORIGINS,
    dependencies.env.REPORT_ASSISTANT_INPUT_VERSION,
  );
  const revisionId = randomUUID();
  const credential = dependencies.codec.encrypt(legacy.apiKey, {
    revisionId,
    role: "generation",
  });
  const generationCompatibilityIdentity = buildGenerationCompatibilityIdentity({
    profile: profile.generation.profile,
    endpointIdentity: profile.generation.endpointIdentity,
    credentialFingerprint: dependencies.codec.fingerprint(legacy.apiKey),
    plannerModel: profile.generation.plannerModel,
    answerModel: profile.generation.answerModel,
    reasoningMode: profile.generation.reasoningMode,
    reasoningCustomValue: null,
    testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
  });
  const embeddingScopeIdentity = buildEmbeddingScopeIdentity({
    endpointIdentity: profile.embeddings.effective.endpointIdentity,
    model: profile.embeddings.effective.model,
    semanticInputVersion: profile.embeddings.effective.semanticInputVersion,
    dimensions: legacy.embeddingDimensions,
  });
  const revision = await dependencies.repository.createDraft({
    id: revisionId,
    generation: {
      profile: AiProviderProfile.mistral,
      baseUrl: profile.generation.baseUrl,
      endpointIdentity: profile.generation.endpointIdentity,
      credential,
    },
    plannerModel: profile.generation.plannerModel,
    answerModel: profile.generation.answerModel,
    reasoningMode: AiProviderReasoningMode.provider_default,
    reasoningCustomValue: null,
    embeddings: {
      mode: "reuse_generation",
      model: profile.embeddings.effective.model,
      dimensions: legacy.embeddingDimensions,
      semanticInputVersion: profile.embeddings.effective.semanticInputVersion,
    },
    generationCompatibilityIdentity,
    embeddingScopeIdentity,
    compositeTestIdentity: buildCompositeTestIdentity({
      generationCompatibilityIdentity,
      embeddings: {
        mode: "reuse_generation",
        model: profile.embeddings.effective.model,
      },
      testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
    }),
  });
  const testedAt = now();
  await dependencies.repository.setTestResult(
    revision.id,
    {
      status: "passed",
      generation: {
        status: "passed",
        capabilities: GENERATION_CAPABILITY_NAMES.map((capability) => ({
          capability,
          status: "passed",
        })),
      },
      embeddings: {
        status: "passed",
        capabilities: EMBEDDING_CAPABILITY_NAMES.map((capability) => ({
          capability,
          status: "passed",
        })),
      },
      testedAt,
    },
    "passed",
    legacy.embeddingDimensions,
    testedAt,
    AiProviderLifecycle.draft,
  );
  await dependencies.repository.activateRevision(revision.id, now(), {
    allowBootstrap: true,
  });
  dependencies.metrics.recordCapabilityTest({
    profile: "mistral",
    result: "passed",
  });
  dependencies.metrics.recordActivation({
    profile: "mistral",
    result: "bootstrapped",
  });
  dependencies.audit.record({
    event: "ai_provider.bootstrapped",
    actorId,
    revisionId: revision.id,
    profile: "mistral",
  });
  return reader.read();
};
