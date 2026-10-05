import type {
  AiProviderCapabilityTestResult,
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
import type {
  AiProviderConfigurationRepository,
  StoredAiProviderRevision,
} from "../infrastructure/ai-provider.repository.js";
import type { AiProviderTestEnqueuer } from "../infrastructure/ai-provider-test.queue.js";
import {
  AesGcmCredentialCodec,
  type StoredCredential,
} from "../infrastructure/credential-codec.js";
import type { AiRuntimeHealth } from "./ai-runtime-health.js";

export type { AiProviderTestEnqueuer } from "../infrastructure/ai-provider-test.queue.js";

export type AiProviderEnvironment = Pick<
  EnvConfig,
  | "AI_PROVIDER_ALLOWED_ORIGINS"
  | "REPORT_ASSISTANT_INPUT_VERSION"
  | "REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED"
>;

export type AiProviderExecutionClaim = Readonly<{
  id: string;
  attempt: number;
}>;

export type AiProviderCapabilityRuntimeConfig = Readonly<{
  reasoningMode: AiProviderReasoningMode;
  reasoningCustomValue: string | null;
}>;

export const AI_PROVIDER_CAPABILITY_TESTER = Symbol(
  "AiProviderCapabilityTester",
);

export type AiProviderCapabilityTester = Readonly<{
  test(
    profile: ResolvedCompositeProviderProfile,
    credentials: Readonly<{ generation: string; embeddings: string }>,
    runtime?: AiProviderCapabilityRuntimeConfig,
  ): Promise<
    Readonly<{
      result: Prisma.JsonValue;
      embeddingDimensions: number | null;
    }>
  >;
}>;

export const AI_PROVIDER_PREPARATION_COORDINATOR = Symbol(
  "AiProviderPreparationCoordinator",
);

export type AiProviderPreparationCoordinator = Readonly<{
  currentSourceFingerprint?(
    revision: StoredAiProviderRevision,
  ): Promise<string>;
  prepare(
    revision: StoredAiProviderRevision,
    previous: StoredAiProviderRevision | null,
    onProgress?: (
      progress: Readonly<{
        completed: number;
        total: number;
        failed: number;
        elapsedMs: number;
        sourceFingerprint?: string;
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
      result: "requested" | "succeeded" | "failed";
    }>,
  ): void;
}>;

export type AiProviderServiceDependencies = Readonly<{
  repository: AiProviderConfigurationRepository;
  codec: AesGcmCredentialCodec;
  env: AiProviderEnvironment;
  tester?: AiProviderCapabilityTester;
  preparation?: AiProviderPreparationCoordinator;
  testEnqueuer?: AiProviderTestEnqueuer;
  runtimeHealth?: AiRuntimeHealth;
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

export class AiProviderConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderConflictError";
  }
}

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
