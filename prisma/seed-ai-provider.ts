import "dotenv/config";

import { aiProviderDraftSchema } from "@customreport/shared";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma } from "@prisma/client";
import {
  AiProviderLifecycle,
  AiProviderProfile,
  PrismaClient,
} from "@prisma/client";
import pg from "pg";

import {
  buildCompositeTestIdentity,
  buildEmbeddingScopeIdentity,
  buildGenerationCompatibilityIdentity,
} from "../apps/api/src/modules/ai-provider/domain/provider-identities.js";
import {
  type ResolvedCompositeProviderProfile,
  resolveProviderProfile,
} from "../apps/api/src/modules/ai-provider/domain/provider-profile.js";
import { AI_PROVIDER_TEST_SUITE_VERSION } from "../apps/api/src/modules/ai-provider/infrastructure/ai-provider-test.queue.js";
import {
  AesGcmCredentialCodec,
  type EncryptedCredential,
} from "../apps/api/src/modules/ai-provider/infrastructure/credential-codec.js";
import {
  assertE2eRuntimeDestructive,
  type DestructiveTargetEnv,
} from "./guards/_destructive-guard.js";
import { isEntrypoint } from "./guards/_entrypoint.js";
import { requireEnv } from "./guards/_require-env.js";
import { seedAiPromptBaseline } from "./seed-ai-prompts.js";

// Opt-in dev/e2e seed step (TASK-145.33): when E2E_AI_PROVIDER_API_KEY is set in
// the operator's untracked environment, create one deterministic provider
// revision — credential encrypted with the product codec — and make it the
// enabled active configuration so the assistant resolves. When the key is
// unset the step is a no-op and the AI stays disabled. The step file lives in
// the prisma tooling tree, which never ships in the production image, and the
// write path re-asserts the destructive-target guard.
export const SEED_AI_PROVIDER_REVISION_ID =
  "a0000000-0000-4000-8000-00000000a003";

interface SeedAiProviderEnv extends DestructiveTargetEnv {
  readonly E2E_AI_PROVIDER_API_KEY?: string;
  readonly E2E_AI_PROVIDER_BASE_URL?: string;
  readonly E2E_AI_PROVIDER_MODEL?: string;
  readonly E2E_AI_PROVIDER_EMBEDDING_MODEL?: string;
  readonly E2E_AI_PROVIDER_EMBEDDING_DIMENSIONS?: string;
  readonly AI_PROVIDER_CONFIG_ENCRYPTION_KEY?: string;
  readonly AI_PROVIDER_CONFIG_KEY_VERSION?: string;
  readonly AI_PROVIDER_ALLOWED_ORIGINS?: string;
  readonly REPORT_ASSISTANT_INPUT_VERSION?: string;
}

const required = (
  env: SeedAiProviderEnv,
  key: keyof SeedAiProviderEnv,
): string => {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(
      `[seed-ai-provider] ${key} must be set when E2E_AI_PROVIDER_API_KEY is set.`,
    );
  }
  return value;
};

const requiredPositiveInt = (
  env: SeedAiProviderEnv,
  key: keyof SeedAiProviderEnv,
): number => {
  const raw = required(env, key);
  if (!/^[1-9]\d*$/u.test(raw)) {
    throw new Error(`[seed-ai-provider] ${key} must be a positive integer.`);
  }
  return Number(raw);
};

interface SeedProviderConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly embeddingModel: string;
  readonly embeddingDimensions: number;
  readonly encryptionKey: string;
  readonly keyVersion: number;
  readonly allowedOrigins: string;
  readonly inputVersion: string;
}

const readSeedProviderConfig = (
  env: SeedAiProviderEnv,
  apiKey: string,
): SeedProviderConfig => ({
  apiKey,
  baseUrl: required(env, "E2E_AI_PROVIDER_BASE_URL"),
  model: required(env, "E2E_AI_PROVIDER_MODEL"),
  embeddingModel: required(env, "E2E_AI_PROVIDER_EMBEDDING_MODEL"),
  embeddingDimensions: requiredPositiveInt(
    env,
    "E2E_AI_PROVIDER_EMBEDDING_DIMENSIONS",
  ),
  encryptionKey: required(env, "AI_PROVIDER_CONFIG_ENCRYPTION_KEY"),
  keyVersion: requiredPositiveInt(env, "AI_PROVIDER_CONFIG_KEY_VERSION"),
  allowedOrigins: required(env, "AI_PROVIDER_ALLOWED_ORIGINS"),
  inputVersion: required(env, "REPORT_ASSISTANT_INPUT_VERSION"),
});

interface ResolvedIdentities {
  readonly generationCompatibilityIdentity: string;
  readonly embeddingScopeIdentity: string;
  readonly compositeTestIdentity: string;
}

const buildSeedIdentities = (
  profile: ResolvedCompositeProviderProfile,
  credentialFingerprint: string,
  embeddingDimensions: number,
): ResolvedIdentities => {
  const generationCompatibilityIdentity = buildGenerationCompatibilityIdentity({
    profile: profile.generation.profile,
    endpointIdentity: profile.generation.endpointIdentity,
    credentialFingerprint,
    plannerModel: profile.generation.plannerModel,
    answerModel: profile.generation.answerModel,
    reasoningMode: profile.generation.reasoningMode,
    reasoningCustomValue: profile.generation.reasoningCustomValue,
    testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
  });
  // Dimensions arrive from the env (the capability test normally measures
  // them); the scope identity is built with the same value the runtime reads.
  const embeddingScopeIdentity = buildEmbeddingScopeIdentity({
    endpointIdentity: profile.embeddings.effective.endpointIdentity,
    model: profile.embeddings.effective.model,
    semanticInputVersion: profile.embeddings.effective.semanticInputVersion,
    dimensions: embeddingDimensions,
  });
  const compositeTestIdentity = buildCompositeTestIdentity({
    generationCompatibilityIdentity,
    embeddings: {
      mode: "reuse_generation",
      model: profile.embeddings.effective.model,
    },
    testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
  });
  return {
    generationCompatibilityIdentity,
    embeddingScopeIdentity,
    compositeTestIdentity,
  };
};

const buildRevisionData = (
  profile: ResolvedCompositeProviderProfile,
  credential: EncryptedCredential,
  identities: ResolvedIdentities,
  embeddingDimensions: number,
): Omit<Prisma.AiProviderConfigurationUncheckedCreateInput, "id"> => ({
  generationProfile: AiProviderProfile.custom_openai_compatible,
  generationBaseUrl: profile.generation.baseUrl,
  generationEndpointIdentity: profile.generation.endpointIdentity,
  plannerModel: profile.generation.plannerModel,
  answerModel: profile.generation.answerModel,
  reasoningMode: profile.generation.reasoningMode,
  reasoningCustomValue: profile.generation.reasoningCustomValue,
  generationCredentialCiphertext: credential.ciphertext,
  generationCredentialNonce: credential.nonce,
  generationCredentialTag: credential.tag,
  generationCredentialKeyVersion: credential.keyVersion,
  generationCredentialMaskedSuffix: credential.maskedSuffix,
  embeddingMode: "reuse_generation",
  embeddingProfile: null,
  embeddingBaseUrl: null,
  embeddingEndpointIdentity: null,
  embeddingModel: profile.embeddings.effective.model,
  embeddingDimensions,
  embeddingCredentialCiphertext: null,
  embeddingCredentialNonce: null,
  embeddingCredentialTag: null,
  embeddingCredentialKeyVersion: null,
  embeddingCredentialMaskedSuffix: null,
  semanticInputVersion: profile.embeddings.effective.semanticInputVersion,
  ...identities,
  lifecycle: AiProviderLifecycle.active,
  activatedAt: new Date(),
  supersededAt: null,
});

interface PreparedRevision {
  readonly data: Omit<Prisma.AiProviderConfigurationUncheckedCreateInput, "id">;
  readonly maskedSuffix: string;
  readonly baseUrl: string;
  readonly answerModel: string;
  readonly embeddingModel: string;
  readonly embeddingDimensions: number;
}

const prepareSeedRevision = (config: SeedProviderConfig): PreparedRevision => {
  const draft = aiProviderDraftSchema.parse({
    generation: {
      profile: "custom-openai-compatible",
      baseUrl: config.baseUrl,
      plannerModel: config.model,
      answerModel: config.model,
      // Reasoning models spend the planner budget thinking and return no tool call.
      reasoningMode: "off",
      credential: config.apiKey,
    },
    embeddings: { mode: "reuse_generation", model: config.embeddingModel },
  });
  const profile = resolveProviderProfile(
    draft,
    config.allowedOrigins,
    config.inputVersion,
  );
  const codec = new AesGcmCredentialCodec(
    config.encryptionKey,
    config.keyVersion,
  );
  const credential = codec.encrypt(config.apiKey, {
    revisionId: SEED_AI_PROVIDER_REVISION_ID,
    role: "generation",
  });
  return {
    data: buildRevisionData(
      profile,
      credential,
      buildSeedIdentities(
        profile,
        codec.fingerprint(config.apiKey),
        config.embeddingDimensions,
      ),
      config.embeddingDimensions,
    ),
    maskedSuffix: credential.maskedSuffix,
    baseUrl: profile.generation.baseUrl,
    answerModel: profile.generation.answerModel,
    embeddingModel: profile.embeddings.effective.model,
    embeddingDimensions: config.embeddingDimensions,
  };
};

/**
 * Seed one enabled AI provider revision from the untracked E2E_AI_PROVIDER_*
 * environment; returns immediately (no DB writes) when the API key is unset.
 */
export async function seedAiProviderFromEnv(
  prisma: PrismaClient,
  env: SeedAiProviderEnv = process.env,
): Promise<void> {
  const apiKey = env.E2E_AI_PROVIDER_API_KEY?.trim();
  if (!apiKey) {
    console.log(
      "[seed-ai-provider] E2E_AI_PROVIDER_API_KEY unset — assistant stays disabled.",
    );
    return;
  }
  assertE2eRuntimeDestructive("seed-ai-provider", env);

  const revisionId = SEED_AI_PROVIDER_REVISION_ID;
  const prepared = prepareSeedRevision(readSeedProviderConfig(env, apiKey));
  await prisma.$transaction(async (transaction) => {
    await transaction.aiProviderConfiguration.upsert({
      where: { id: revisionId },
      create: { id: revisionId, ...prepared.data },
      update: prepared.data,
    });
    const control = await transaction.aiProviderControl.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
      select: { activeConfigurationId: true },
    });
    const previousId = control.activeConfigurationId;
    if (previousId && previousId !== revisionId) {
      await transaction.aiProviderConfiguration.updateMany({
        where: { id: previousId, lifecycle: AiProviderLifecycle.active },
        data: {
          lifecycle: AiProviderLifecycle.superseded,
          supersededAt: new Date(),
        },
      });
    }
    await transaction.aiProviderControl.update({
      where: { id: "singleton" },
      data: { enabled: true, activeConfigurationId: revisionId },
    });
  });
  // The assistant resolves only when an active prompt bundle exists too;
  // profiles whose writers skip it (minimal, demo) get the baseline here.
  await seedAiPromptBaseline(prisma);

  console.log(
    `[seed-ai-provider] enabled provider revision ${revisionId} ` +
      `(endpoint=${prepared.baseUrl}, model=${prepared.answerModel}, ` +
      `embedding=${prepared.embeddingModel}/${prepared.embeddingDimensions}d, ` +
      `credential=${prepared.maskedSuffix})`,
  );
}

async function main(): Promise<void> {
  assertE2eRuntimeDestructive("seed-ai-provider");
  const pool = new pg.Pool({ connectionString: requireEnv("DATABASE_URL") });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await seedAiProviderFromEnv(prisma);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (isEntrypoint(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error("[seed-ai-provider] Failed:", error);
    process.exitCode = 1;
  });
}
