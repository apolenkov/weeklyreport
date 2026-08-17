import type {
  AiProviderAnswerProtocol,
  AiProviderCapabilityTestResult,
  AiProviderFeatureCompatibility,
  AiProviderProfile as SharedAiProviderProfile,
  AiProviderReasoningMode,
} from "@customreport/shared";
import {
  AiProviderLifecycle,
  AiProviderProfile,
  type Prisma,
} from "@prisma/client";

import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import type {
  ResolvedCompositeProviderProfile,
  ResolvedProviderProfile,
} from "../domain/provider-profile.js";
import type { AiCompatibilityEnqueuer } from "../infrastructure/ai-compatibility.queue.js";
import type {
  AiProviderConfigurationRepository,
  StoredAiProviderRevision,
} from "../infrastructure/ai-provider.repository.js";
import {
  AesGcmCredentialCodec,
  type StoredCredential,
} from "../infrastructure/credential-codec.js";

export type AiProviderEnvironment = Pick<
  EnvConfig,
  | "AI_PROVIDER_ALLOWED_ORIGINS"
  | "REPORT_ASSISTANT_INPUT_VERSION"
  | "MISTRAL_API_KEY"
  | "MISTRAL_PLANNER_MODEL"
  | "MISTRAL_ANSWER_MODEL"
  | "MISTRAL_EMBEDDING_MODEL"
  | "MISTRAL_EMBEDDING_DIMENSIONS"
>;

export type LegacyAiProviderSettings = Readonly<{
  apiKey: string;
  plannerModel: string;
  answerModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
}>;

export const legacySettings = (
  env: AiProviderEnvironment,
): LegacyAiProviderSettings | null => {
  const {
    MISTRAL_API_KEY: apiKey,
    MISTRAL_PLANNER_MODEL: plannerModel,
    MISTRAL_ANSWER_MODEL: answerModel,
    MISTRAL_EMBEDDING_MODEL: embeddingModel,
    MISTRAL_EMBEDDING_DIMENSIONS: embeddingDimensions,
  } = env;
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
};

export type AiProviderCapabilityRuntimeConfig = Readonly<{
  reasoningMode: AiProviderReasoningMode;
  reasoningCustomValue: string | null;
}>;

export type AiProviderTestEnqueuer = AiCompatibilityEnqueuer;

export type AiProviderCapabilityTester = Readonly<{
  test(
    profile: ResolvedCompositeProviderProfile | ResolvedProviderProfile,
    credentials: Readonly<{ generation: string; embeddings: string }> | string,
    runtime?: AiProviderCapabilityRuntimeConfig,
  ): Promise<
    Readonly<{
      result: Prisma.JsonValue;
      embeddingDimensions: number | null;
      answerProtocol?: AiProviderAnswerProtocol | null;
    }>
  >;
}>;

export type AiProviderPromptCompatibility = Readonly<{
  evaluate(provider: StoredAiProviderRevision): Promise<
    Readonly<{
      status: AiProviderCapabilityTestResult["status"];
      features: readonly AiProviderFeatureCompatibility[];
    }>
  >;
  verify(provider: StoredAiProviderRevision): Promise<boolean>;
  currentFeatureEvaluatorVersions?: () => Readonly<Record<string, string>>;
}>;

export type AiProviderPreparationCoordinator = Readonly<{
  prepare(
    revision: StoredAiProviderRevision,
    previous: StoredAiProviderRevision | null,
    onProgress?: (
      progress: Readonly<{
        completed: number;
        total: number;
        failed: number;
        elapsedMs: number;
      }>,
    ) => Promise<void>,
  ): Promise<
    Readonly<{
      completed: number;
      total: number;
      failed: number;
      elapsedMs: number;
    }>
  >;
}>;

export type AiProviderAuditSink = Readonly<{
  record(event: Readonly<Record<string, string | number | null>>): void;
}>;

export type AiProviderStateMetrics = Readonly<{
  profile: SharedAiProviderProfile | "none";
  state: AiProviderLifecycle | "not_configured";
}>;

export type AiProviderCapabilityTestMetrics = Readonly<{
  profile: SharedAiProviderProfile;
  result: AiProviderCapabilityTestResult["status"];
}>;

export type AiProviderPreparationMetrics = Readonly<{
  profile: SharedAiProviderProfile;
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
}>;

export type AiProviderMetricsSink = Readonly<{
  recordState(input: AiProviderStateMetrics): void;
  recordCapabilityTest(input: AiProviderCapabilityTestMetrics): void;
  recordPreparation(input: AiProviderPreparationMetrics): void;
  recordActivation(
    input: Readonly<{
      profile: SharedAiProviderProfile;
      result: "requested" | "succeeded" | "failed" | "bootstrapped";
    }>,
  ): void;
}>;

export type AiProviderServiceDependencies = Readonly<{
  repository: AiProviderConfigurationRepository;
  codec: AesGcmCredentialCodec;
  env: AiProviderEnvironment;
  tester?: AiProviderCapabilityTester;
  preparation?: AiProviderPreparationCoordinator;
  promptCompatibility?: AiProviderPromptCompatibility;
  testEnqueuer?: AiProviderTestEnqueuer;
  audit: AiProviderAuditSink;
  metrics: AiProviderMetricsSink;
}>;

export class AiProviderNotFoundError extends Error {
  constructor() {
    super("AI provider configuration was not found");
    this.name = "AiProviderNotFoundError";
  }
}

export class AiProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderConfigurationError";
  }
}

export const NOOP_AUDIT: AiProviderAuditSink = { record: () => undefined };

export const NOOP_METRICS: AiProviderMetricsSink = {
  recordState: () => undefined,
  recordCapabilityTest: () => undefined,
  recordPreparation: () => undefined,
  recordActivation: () => undefined,
};

export const now = (): Date => new Date();

export const toPrismaProfile = (
  profile: ResolvedProviderProfile["profile"],
): AiProviderProfile =>
  profile === "custom-openai-compatible"
    ? AiProviderProfile.custom_openai_compatible
    : profile;

export const toSharedProfile = (
  profile: AiProviderProfile,
): ResolvedProviderProfile["profile"] =>
  profile === AiProviderProfile.custom_openai_compatible
    ? "custom-openai-compatible"
    : profile;

export const credentialFrom = (
  revision: StoredAiProviderRevision,
  role: "generation" | "embeddings" = "generation",
): StoredCredential => ({
  ciphertext:
    role === "generation"
      ? revision.generationCredentialCiphertext
      : requiredEmbeddingCredential(revision, "embeddingCredentialCiphertext"),
  nonce:
    role === "generation"
      ? revision.generationCredentialNonce
      : requiredEmbeddingCredential(revision, "embeddingCredentialNonce"),
  tag:
    role === "generation"
      ? revision.generationCredentialTag
      : requiredEmbeddingCredential(revision, "embeddingCredentialTag"),
  keyVersion:
    role === "generation"
      ? revision.generationCredentialKeyVersion
      : requiredEmbeddingCredential(revision, "embeddingCredentialKeyVersion"),
  maskedSuffix:
    role === "generation"
      ? revision.generationCredentialMaskedSuffix
      : requiredEmbeddingCredential(
          revision,
          "embeddingCredentialMaskedSuffix",
        ),
});

const requiredEmbeddingCredential = <
  Key extends
    | "embeddingCredentialCiphertext"
    | "embeddingCredentialNonce"
    | "embeddingCredentialTag"
    | "embeddingCredentialKeyVersion"
    | "embeddingCredentialMaskedSuffix",
>(
  revision: StoredAiProviderRevision,
  key: Key,
): NonNullable<StoredAiProviderRevision[Key]> => {
  const value = revision[key];
  if (revision.embeddingMode !== "separate" || value === null) {
    throw new AiProviderConfigurationError(
      "A separate embedding credential is not configured",
    );
  }
  return value;
};
