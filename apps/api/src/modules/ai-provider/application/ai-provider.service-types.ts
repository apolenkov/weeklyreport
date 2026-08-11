import type { AiProviderProfile as SharedAiProviderProfile } from "@customreport/shared";
import {
  AiProviderLifecycle,
  AiProviderProfile,
  type Prisma,
} from "@prisma/client";

import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import type { ResolvedProviderProfile } from "../domain/provider-profile.js";
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

export type AiProviderCapabilityTester = Readonly<{
  test(
    profile: ResolvedProviderProfile,
    credential: string,
  ): Promise<
    Readonly<{
      result: Prisma.JsonValue;
      embeddingDimensions: number | null;
    }>
  >;
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
  result: "passed" | "failed";
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
): StoredCredential => ({
  ciphertext: revision.credentialCiphertext,
  nonce: revision.credentialNonce,
  tag: revision.credentialTag,
  keyVersion: revision.credentialKeyVersion,
  maskedSuffix: revision.credentialMaskedSuffix,
});
