import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import type {
  AiProviderConfigurationRepository,
  StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import { AesGcmCredentialCodec } from "../../ai-provider/index.js";
import {
  OpenAiCompatibleAnswerAdapter,
  OpenAiCompatibleEmbeddingAdapter,
  OpenAiCompatiblePlannerAdapter,
} from "../infrastructure/openai-compatible.adapters.js";
import { OpenAiCompatibleTransport } from "../infrastructure/openai-compatible.transport.js";
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

const requiredEmbeddingDimensions = (value: number | null): number => {
  if (value === null) throw new AiRuntimeNotConfiguredError();
  return value;
};

export type AiRuntimeSnapshot = Readonly<{
  revisionId: string;
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

type RuntimeClients = Readonly<{
  planner: ReportAssistantPlannerPort & ReportAssistantPlannerRepairPort;
  answerer: ReportAssistantAnswerPort & ReportAssistantCitationRepairPort;
  embeddings: EmbeddingPort;
  scope: SemanticEmbeddingScope;
  model: string;
}>;

const toSharedProfile = (profile: StoredAiProviderRevision["profile"]) =>
  profile === "custom_openai_compatible"
    ? ("custom-openai-compatible" as const)
    : profile;

export class AiRuntimeNotConfiguredError extends Error {
  constructor() {
    super("AI provider is not configured");
    this.name = "AiRuntimeNotConfiguredError";
  }
}

export class AiRuntimeResolver implements AiRuntimeResolverPort {
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
    >,
  ) {}

  async resolveActive(): Promise<AiRuntimeSnapshot | null> {
    const control = await this.repository.getControl();
    const active = control?.activeConfiguration;
    if (control?.enabled !== true || active?.lifecycle !== "active") {
      return null;
    }
    return this.resolveRevision(active);
  }

  async resolveExact(revisionId: string): Promise<AiRuntimeSnapshot> {
    const revision = await this.repository.getRevision(revisionId);
    if (!revision) throw new AiRuntimeNotConfiguredError();
    return this.resolveRevision(revision);
  }

  private resolveRevision(
    revision: StoredAiProviderRevision,
  ): AiRuntimeSnapshot {
    const clients =
      this.clients.get(revision.id) ?? this.createClients(revision);
    this.clients.set(revision.id, clients);
    const semanticRetrieval = new SemanticRetrievalService(
      clients.embeddings,
      this.semanticRepository,
      {
        configurationRevisionId: revision.id,
        scope: clients.scope,
        similarityThreshold: this.env.REPORT_ASSISTANT_SIMILARITY_THRESHOLD,
        readThroughLimit: this.env.REPORT_ASSISTANT_READ_THROUGH_LIMIT,
        enqueuer: this.semanticEnqueuer,
      },
    );
    return {
      revisionId: revision.id,
      planner: clients.planner,
      answerer: clients.answerer,
      embeddings: clients.embeddings,
      semanticRetrieval,
      scope: clients.scope,
      model: clients.model,
    };
  }

  private createClients(revision: StoredAiProviderRevision): RuntimeClients {
    const embeddingDimensions = requiredEmbeddingDimensions(
      revision.embeddingDimensions,
    );
    const credential = this.codec.decrypt({
      ciphertext: revision.credentialCiphertext,
      nonce: revision.credentialNonce,
      tag: revision.credentialTag,
      keyVersion: revision.credentialKeyVersion,
      maskedSuffix: revision.credentialMaskedSuffix,
    });
    const transport = new OpenAiCompatibleTransport({
      baseUrl: revision.baseUrl,
      credential,
      timeoutMs: this.env.REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS,
    });
    const planner = new OpenAiCompatiblePlannerAdapter(transport, {
      model: revision.plannerModel,
      maxTokens: this.env.REPORT_ASSISTANT_PLANNER_MAX_TOKENS,
    });
    const answerer = new OpenAiCompatibleAnswerAdapter(transport, {
      model: revision.answerModel,
      maxTokens: this.env.REPORT_ASSISTANT_ANSWER_MAX_TOKENS,
    });
    const embeddings = new OpenAiCompatibleEmbeddingAdapter(transport, {
      model: revision.embeddingModel,
      dimensions: embeddingDimensions,
      batchSize: this.env.REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE,
      tokenBudget: this.env.REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET,
    });
    return {
      planner,
      answerer,
      embeddings,
      scope: {
        provider: revision.endpointIdentity,
        model: revision.embeddingModel,
        inputVersion: revision.semanticInputVersion,
        dimensions: embeddingDimensions,
      },
      model: `${toSharedProfile(revision.profile)}:${revision.answerModel}`,
    };
  }
}
