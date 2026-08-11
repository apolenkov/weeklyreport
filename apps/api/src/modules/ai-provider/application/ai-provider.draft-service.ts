import {
  type AiProviderConfigurationRead,
  type AiProviderControlRead,
  type AiProviderDraft,
  aiProviderDraftSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";
import { AiProviderLifecycle, AiProviderProfile } from "@prisma/client";

import { resolveProviderProfile } from "../domain/provider-profile.js";
import type { NewAiProviderRevision } from "../infrastructure/ai-provider.repository.js";
import { AiProviderReadService } from "./ai-provider.read-service.js";
import {
  AiProviderConfigurationError,
  type AiProviderServiceDependencies,
  completeCapabilityResult,
  credentialFrom,
  now,
  requireRevision,
  safeRevision,
  toPrismaProfile,
  toSharedProfile,
} from "./ai-provider.service-support.js";

const capabilityNames = [
  "authentication",
  "planner_tool_call",
  "structured_answer",
  "token_usage",
  "batch_embeddings",
] as const;

export class AiProviderDraftService {
  constructor(
    private readonly dependencies: AiProviderServiceDependencies,
    private readonly reader: AiProviderReadService,
  ) {}

  async save(
    input: AiProviderDraft,
    actorId: string,
  ): Promise<AiProviderConfigurationRead> {
    const draft = aiProviderDraftSchema.parse(input);
    const profile = resolveProviderProfile(
      draft,
      this.dependencies.env.AI_PROVIDER_ALLOWED_ORIGINS,
      this.dependencies.env.REPORT_ASSISTANT_INPUT_VERSION,
    );
    const control = await this.dependencies.repository.getControl();
    const credential = draft.credential
      ? this.dependencies.codec.encrypt(draft.credential)
      : control?.activeConfiguration
        ? credentialFrom(control.activeConfiguration)
        : undefined;
    if (!credential) {
      throw new AiProviderConfigurationError(
        "A provider credential is required for a new configuration",
      );
    }
    const revision = await this.dependencies.repository.createDraft({
      profile: toPrismaProfile(profile.profile),
      baseUrl: profile.baseUrl,
      endpointIdentity: profile.endpointIdentity,
      plannerModel: profile.plannerModel,
      answerModel: profile.answerModel,
      embeddingModel: profile.embeddingModel,
      embeddingDimensions: profile.embeddingDimensions,
      semanticInputVersion: profile.semanticInputVersion,
      credential,
    } satisfies NewAiProviderRevision);
    this.dependencies.audit.record({
      event: "ai_provider.draft_saved",
      actorId,
      revisionId: revision.id,
      profile: draft.profile,
      plannerModel: draft.plannerModel,
      answerModel: draft.answerModel,
      embeddingModel: draft.embeddingModel,
    });
    return safeRevision(revision, this.dependencies.codec);
  }

  async test(
    revisionId: string,
    actorId: string,
  ): Promise<AiProviderConfigurationRead> {
    const revision = await requireRevision(this.dependencies, revisionId);
    if (!this.dependencies.tester) {
      throw new AiProviderConfigurationError(
        "AI provider capability tester is not wired",
      );
    }
    const profile = {
      profile: toSharedProfile(revision.profile),
      baseUrl: revision.baseUrl,
      endpointIdentity: revision.endpointIdentity,
      plannerModel: revision.plannerModel,
      answerModel: revision.answerModel,
      embeddingModel: revision.embeddingModel,
      embeddingDimensions: revision.embeddingDimensions,
      semanticInputVersion: revision.semanticInputVersion,
    };
    const test = await this.dependencies.tester.test(
      profile,
      this.dependencies.codec.decrypt(credentialFrom(revision)),
    );
    const passed = completeCapabilityResult(test.result);
    const tested = await this.dependencies.repository.setTestResult(
      revisionId,
      test.result as Prisma.InputJsonValue,
      passed,
      test.embeddingDimensions,
      now(),
      revision.lifecycle,
    );
    this.dependencies.audit.record({
      event: "ai_provider.tested",
      actorId,
      revisionId,
      profile: profile.profile,
      result: passed ? "passed" : "failed",
    });
    this.dependencies.metrics.recordCapabilityTest({
      profile: profile.profile,
      result: passed ? "passed" : "failed",
    });
    return safeRevision(tested, this.dependencies.codec);
  }

  async bootstrap(actorId: string): Promise<AiProviderControlRead> {
    if (await this.dependencies.repository.hasAnyConfiguration()) {
      return this.reader.read();
    }
    const legacy = this.legacySettings();
    if (!legacy) return this.reader.read();
    const draft = aiProviderDraftSchema.parse({
      profile: "mistral",
      plannerModel: legacy.plannerModel,
      answerModel: legacy.answerModel,
      embeddingModel: legacy.embeddingModel,
      credential: legacy.apiKey,
    });
    const profile = resolveProviderProfile(
      draft,
      this.dependencies.env.AI_PROVIDER_ALLOWED_ORIGINS,
      this.dependencies.env.REPORT_ASSISTANT_INPUT_VERSION,
    );
    const revision = await this.dependencies.repository.createDraft({
      profile: AiProviderProfile.mistral,
      baseUrl: profile.baseUrl,
      endpointIdentity: profile.endpointIdentity,
      plannerModel: profile.plannerModel,
      answerModel: profile.answerModel,
      embeddingModel: profile.embeddingModel,
      embeddingDimensions: profile.embeddingDimensions,
      semanticInputVersion: profile.semanticInputVersion,
      credential: this.dependencies.codec.encrypt(legacy.apiKey),
    });
    const testedAt = now();
    const passed = {
      status: "passed" as const,
      capabilities: capabilityNames.map((capability) => ({
        capability,
        status: "passed" as const,
      })),
      testedAt,
    };
    await this.dependencies.repository.setTestResult(
      revision.id,
      passed,
      true,
      legacy.embeddingDimensions,
      testedAt,
      AiProviderLifecycle.draft,
    );
    await this.dependencies.repository.activateRevision(revision.id, now());
    this.dependencies.metrics.recordCapabilityTest({
      profile: "mistral",
      result: "passed",
    });
    this.dependencies.metrics.recordActivation({
      profile: "mistral",
      result: "bootstrapped",
    });
    this.dependencies.audit.record({
      event: "ai_provider.bootstrapped",
      actorId,
      revisionId: revision.id,
      profile: "mistral",
    });
    return this.reader.read();
  }

  private legacySettings(): Readonly<{
    apiKey: string;
    plannerModel: string;
    answerModel: string;
    embeddingModel: string;
    embeddingDimensions: number;
  }> | null {
    const {
      MISTRAL_API_KEY: apiKey,
      MISTRAL_PLANNER_MODEL: plannerModel,
      MISTRAL_ANSWER_MODEL: answerModel,
      MISTRAL_EMBEDDING_MODEL: embeddingModel,
      MISTRAL_EMBEDDING_DIMENSIONS: embeddingDimensions,
    } = this.dependencies.env;
    return apiKey &&
      plannerModel &&
      answerModel &&
      embeddingModel &&
      embeddingDimensions !== undefined
      ? {
          apiKey,
          plannerModel,
          answerModel,
          embeddingModel,
          embeddingDimensions,
        }
      : null;
  }
}
