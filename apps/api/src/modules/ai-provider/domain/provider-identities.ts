import { createHash } from "node:crypto";

import type {
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@customreport/shared";

const AI_PROVIDER_IDENTITY_VERSION = "ai-provider-identities/v1";
const AI_PROVIDER_PROFILE_REGISTRY_VERSION = "provider-profile-registry/v1";
const AI_PROVIDER_CAPABILITY_SUITE_VERSION = "provider-test/v1";
const AI_PROVIDER_GENERATION_CONTRACT_VERSION = "generation-contract/v1";
const AI_PROVIDER_SAMPLING_POLICY_VERSION = "provider-default-sampling/v1";

const fingerprint = (value: Readonly<Record<string, unknown>>): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const buildGenerationCompatibilityIdentity = (
  input: Readonly<{
    profile: AiProviderProfile;
    endpointIdentity: string;
    credentialFingerprint: string;
    plannerModel: string;
    answerModel: string;
    reasoningMode: AiProviderReasoningMode;
    reasoningCustomValue: string | null;
    testSuiteVersion: string;
  }>,
): string =>
  fingerprint({
    version: AI_PROVIDER_IDENTITY_VERSION,
    profile: input.profile,
    endpointIdentity: input.endpointIdentity,
    credentialFingerprint: input.credentialFingerprint,
    plannerModel: input.plannerModel,
    answerModel: input.answerModel,
    reasoningMode: input.reasoningMode,
    reasoningCustomValue: input.reasoningCustomValue,
    samplingPolicyVersion: AI_PROVIDER_SAMPLING_POLICY_VERSION,
    contractVersion: AI_PROVIDER_GENERATION_CONTRACT_VERSION,
    testSuiteVersion: input.testSuiteVersion,
  });

export const buildEmbeddingScopeIdentity = (
  input: Readonly<{
    endpointIdentity: string;
    model: string;
    semanticInputVersion: string;
    dimensions: number | null;
  }>,
): string =>
  fingerprint({
    version: AI_PROVIDER_IDENTITY_VERSION,
    endpointIdentity: input.endpointIdentity,
    model: input.model,
    semanticInputVersion: input.semanticInputVersion,
    dimensions: input.dimensions,
  });

export const buildCompositeTestIdentity = (
  input: Readonly<{
    generationCompatibilityIdentity: string;
    embeddings:
      | Readonly<{ mode: "reuse_generation"; model: string }>
      | Readonly<{
          mode: "separate";
          profile: AiProviderProfile;
          endpointIdentity: string;
          credentialFingerprint: string;
          model: string;
        }>;
    testSuiteVersion: string;
  }>,
): string =>
  fingerprint({
    version: AI_PROVIDER_IDENTITY_VERSION,
    generationCompatibilityIdentity: input.generationCompatibilityIdentity,
    embeddings: input.embeddings,
    profileRegistryVersion: AI_PROVIDER_PROFILE_REGISTRY_VERSION,
    capabilitySuiteVersion: AI_PROVIDER_CAPABILITY_SUITE_VERSION,
    testSuiteVersion: input.testSuiteVersion,
  });
