import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import type { AiComposedPromptSet } from "../../ai-prompts/index.js";
import type {
  AesGcmCredentialCodec,
  StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import { toSharedProfile } from "../../ai-provider/index.js";
import { OpenAiCompatiblePlannerAdapter } from "../infrastructure/openai-compatible.adapters.js";
import { OpenAiCompatibleAnswerAdapter } from "../infrastructure/openai-compatible.answer-adapter.js";
import { OpenAiCompatibleEmbeddingAdapter } from "../infrastructure/openai-compatible.embedding-adapter.js";
import { OpenAiCompatibleTransport } from "../infrastructure/openai-compatible.transport.js";
import {
  runtimeOnlyAnswererWithRepair,
  runtimeOnlyPlannerWithRepair,
} from "../search.runtime.js";
import type {
  EmbeddingPort,
  ReportAssistantAnswerPort,
  ReportAssistantCitationRepairPort,
  ReportAssistantPlannerPort,
  ReportAssistantPlannerRepairPort,
} from "./report-assistant.ports.js";
import type { SemanticEmbeddingScope } from "./semantic-embedding.repository.js";

export type RuntimeClients = Readonly<{
  planner: ReportAssistantPlannerPort & ReportAssistantPlannerRepairPort;
  answerer: ReportAssistantAnswerPort & ReportAssistantCitationRepairPort;
  embeddings: EmbeddingPort;
  scope: SemanticEmbeddingScope;
  model: string;
}>;

export type RuntimeClientEnvironment = Pick<
  EnvConfig,
  | "REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS"
  | "REPORT_ASSISTANT_PLANNER_MAX_TOKENS"
  | "REPORT_ASSISTANT_ANSWER_MAX_TOKENS"
  | "REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE"
  | "REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET"
>;

type RuntimeErrorFactory = () => Error;

const required = <Value>(
  value: Value | null,
  createError: RuntimeErrorFactory,
): Value => {
  if (value === null) throw createError();
  return value;
};

const requiredEmbeddingCredential = <Value>(value: Value | null): Value =>
  required(value, () => new Error("Embedding credential is not configured"));

const decryptCredential = (
  codec: AesGcmCredentialCodec,
  revision: StoredAiProviderRevision,
  role: "generation" | "embeddings",
): string =>
  codec.decrypt(
    {
      ciphertext:
        role === "generation"
          ? revision.generationCredentialCiphertext
          : requiredEmbeddingCredential(revision.embeddingCredentialCiphertext),
      nonce:
        role === "generation"
          ? revision.generationCredentialNonce
          : requiredEmbeddingCredential(revision.embeddingCredentialNonce),
      tag:
        role === "generation"
          ? revision.generationCredentialTag
          : requiredEmbeddingCredential(revision.embeddingCredentialTag),
      keyVersion:
        role === "generation"
          ? revision.generationCredentialKeyVersion
          : requiredEmbeddingCredential(revision.embeddingCredentialKeyVersion),
      maskedSuffix:
        role === "generation"
          ? revision.generationCredentialMaskedSuffix
          : requiredEmbeddingCredential(
              revision.embeddingCredentialMaskedSuffix,
            ),
    },
    { revisionId: revision.id, role },
  );

export const createRuntimeClients = (
  revision: StoredAiProviderRevision,
  prompts: AiComposedPromptSet | null,
  {
    codec,
    env,
    createError,
  }: Readonly<{
    codec: AesGcmCredentialCodec;
    env: RuntimeClientEnvironment;
    createError: RuntimeErrorFactory;
  }>,
): RuntimeClients => {
  const dimensions = required(revision.embeddingDimensions, createError);
  const generationTransport = new OpenAiCompatibleTransport({
    baseUrl: revision.generationBaseUrl,
    credential: decryptCredential(codec, revision, "generation"),
    timeoutMs: env.REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS,
  });
  const embeddingTransport =
    revision.embeddingMode === "reuse_generation"
      ? generationTransport
      : new OpenAiCompatibleTransport({
          baseUrl: required(revision.embeddingBaseUrl, createError),
          credential: decryptCredential(codec, revision, "embeddings"),
          timeoutMs: env.REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS,
        });
  const reasoning = {
    profile: toSharedProfile(revision.generationProfile),
    mode: revision.reasoningMode,
    customValue: revision.reasoningCustomValue,
  } as const;
  const planner = prompts
    ? new OpenAiCompatiblePlannerAdapter(generationTransport, {
        model: revision.plannerModel,
        maxTokens: env.REPORT_ASSISTANT_PLANNER_MAX_TOKENS,
        reasoning,
        prompts,
      })
    : runtimeOnlyPlannerWithRepair();
  const answerer = prompts
    ? new OpenAiCompatibleAnswerAdapter(generationTransport, {
        model: revision.answerModel,
        maxTokens: env.REPORT_ASSISTANT_ANSWER_MAX_TOKENS,
        reasoning,
        prompts,
      })
    : runtimeOnlyAnswererWithRepair();
  const embeddings = new OpenAiCompatibleEmbeddingAdapter(embeddingTransport, {
    model: revision.embeddingModel,
    dimensions,
    batchSize: env.REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE,
    tokenBudget: env.REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET,
  });
  return {
    planner,
    answerer,
    embeddings,
    scope: {
      embeddingScopeIdentity: revision.embeddingScopeIdentity,
      provider:
        revision.embeddingMode === "reuse_generation"
          ? revision.generationEndpointIdentity
          : required(revision.embeddingEndpointIdentity, createError),
      model: revision.embeddingModel,
      inputVersion: revision.semanticInputVersion,
      dimensions,
    },
    model: `${toSharedProfile(revision.generationProfile)}:${revision.answerModel}`,
  };
};
