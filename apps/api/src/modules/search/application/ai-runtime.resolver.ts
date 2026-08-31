import type { AiProviderReasoningMode } from "@customreport/shared";

import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import type { AiComposedPromptSet } from "../../ai-prompts/index.js";
import type {
  AesGcmCredentialCodec,
  AiProviderConfigurationRepository,
  StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import type { AiRuntimeConfigurationRepository } from "../infrastructure/ai-runtime-configuration.prisma-repository.js";
import {
  createRuntimeClients,
  type RuntimeClients,
} from "./ai-runtime.clients.js";
import type {
  EmbeddingPort,
  ReportAssistantAnswerPort,
  ReportAssistantCitationRepairPort,
  ReportAssistantPlannerPort,
  ReportAssistantPlannerRepairPort,
} from "./report-assistant.ports.js";
import type {
  SemanticEmbeddingRepository,
  SemanticEmbeddingScope,
} from "./semantic-embedding.repository.js";
import type { SemanticIndexEnqueuer } from "./semantic-index.enqueuer.js";
import { SemanticRetrievalService } from "./semantic-retrieval.service.js";

export type AiRuntimeSnapshot = Readonly<{
  revisionId: string;
  generationCompatibilityIdentity: string;
  embeddingScopeIdentity: string;
  featureKey: string | null;
  promptRevisionId: string | null;
  servingContractVersion: string | null;
  coreContractVersion: string | null;
  prompts: AiComposedPromptSet | null;
  reasoningMode: AiProviderReasoningMode;
  reasoningCustomValue: string | null;
  planner: ReportAssistantPlannerPort & ReportAssistantPlannerRepairPort;
  answerer: ReportAssistantAnswerPort & ReportAssistantCitationRepairPort;
  embeddings: EmbeddingPort;
  semanticRetrieval: SemanticRetrievalService;
  scope: SemanticEmbeddingScope;
  model: string;
}>;

export type AiRuntimeResolverPort = Readonly<{
  resolveActive(): Promise<AiRuntimeSnapshot | null>;
  resolveExact(revisionId: string): Promise<AiRuntimeSnapshot>;
}>;

export class AiRuntimeNotConfiguredError extends Error {
  constructor() {
    super("AI provider is not configured");
    this.name = "AiRuntimeNotConfiguredError";
  }
}

export class AiRuntimeResolver implements AiRuntimeResolverPort {
  private static readonly CLIENT_CACHE_LIMIT = 4;
  private readonly clients = new Map<string, RuntimeClients>();

  constructor(
    private readonly repository: AiProviderConfigurationRepository,
    private readonly codec: AesGcmCredentialCodec,
    private readonly semanticRepository: SemanticEmbeddingRepository,
    private readonly semanticEnqueuer: SemanticIndexEnqueuer,
    private readonly env: Pick<
      EnvConfig,
      | "REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS"
      | "REPORT_ASSISTANT_PLANNER_MAX_TOKENS"
      | "REPORT_ASSISTANT_ANSWER_MAX_TOKENS"
      | "REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE"
      | "REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET"
      | "REPORT_ASSISTANT_SIMILARITY_THRESHOLD"
      | "REPORT_ASSISTANT_READ_THROUGH_LIMIT"
      | "REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED"
    >,
    private readonly configurationRepository: Pick<
      AiRuntimeConfigurationRepository,
      "resolveReportAssistant"
    >,
  ) {}

  async resolveActive(): Promise<AiRuntimeSnapshot | null> {
    if (!this.env.REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED) {
      return null;
    }
    const configuration =
      await this.configurationRepository.resolveReportAssistant();
    return configuration
      ? this.resolveRevision(
          configuration.provider,
          configuration.prompts,
          configuration.featureKey,
          configuration.promptRevisionId,
          configuration.servingContractVersion,
          configuration.coreContractVersion,
        )
      : null;
  }

  async resolveExact(revisionId: string): Promise<AiRuntimeSnapshot> {
    if (!this.env.REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED) {
      throw new AiRuntimeNotConfiguredError();
    }
    const revision = await this.repository.getRevision(revisionId);
    if (!revision) throw new AiRuntimeNotConfiguredError();
    return this.resolveRevision(revision, null, null, null, null, null);
  }

  private resolveRevision(
    revision: StoredAiProviderRevision,
    prompts: AiComposedPromptSet | null,
    featureKey: string | null,
    promptRevisionId: string | null,
    servingContractVersion: string | null,
    coreContractVersion: string | null,
  ): AiRuntimeSnapshot {
    // Exact embedding workers intentionally have no generation prompts. The
    // active assistant has a persisted prompt identity, so its client set is
    // kept separate even when both snapshots use the same provider revision.
    const promptIdentity = prompts
      ? `prompt:${prompts.servingContractVersion}:${prompts.contentHash}`
      : "embedding-only";
    const cacheKey = [
      revision.id,
      promptIdentity,
      revision.generationCompatibilityIdentity,
      revision.embeddingScopeIdentity,
    ].join(":");
    const clients = this.getOrCreateClients(cacheKey, () =>
      createRuntimeClients(
        revision,
        prompts,
        this.codec,
        this.env,
        () => new AiRuntimeNotConfiguredError(),
      ),
    );
    return {
      revisionId: revision.id,
      generationCompatibilityIdentity: revision.generationCompatibilityIdentity,
      embeddingScopeIdentity: revision.embeddingScopeIdentity,
      featureKey,
      promptRevisionId,
      servingContractVersion,
      coreContractVersion,
      prompts,
      reasoningMode: revision.reasoningMode,
      reasoningCustomValue: revision.reasoningCustomValue,
      planner: clients.planner,
      answerer: clients.answerer,
      embeddings: clients.embeddings,
      semanticRetrieval: new SemanticRetrievalService(
        clients.embeddings,
        this.semanticRepository,
        {
          configurationRevisionId: revision.id,
          scope: clients.scope,
          similarityThreshold: this.env.REPORT_ASSISTANT_SIMILARITY_THRESHOLD,
          readThroughLimit: this.env.REPORT_ASSISTANT_READ_THROUGH_LIMIT,
          enqueuer: this.semanticEnqueuer,
        },
      ),
      scope: clients.scope,
      model: clients.model,
    };
  }

  private getOrCreateClients(
    cacheKey: string,
    create: () => RuntimeClients,
  ): RuntimeClients {
    const cached = this.clients.get(cacheKey);
    if (cached) {
      this.clients.delete(cacheKey);
      this.clients.set(cacheKey, cached);
      return cached;
    }
    const clients = create();
    this.clients.set(cacheKey, clients);
    while (this.clients.size > AiRuntimeResolver.CLIENT_CACHE_LIMIT) {
      const oldestKey = this.clients.keys().next().value;
      if (oldestKey === undefined) break;
      this.clients.delete(oldestKey);
    }
    return clients;
  }
}
