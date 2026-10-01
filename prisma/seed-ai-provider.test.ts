import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AesGcmCredentialCodec } from "../apps/api/src/modules/ai-provider/infrastructure/credential-codec.js";
import {
  SEED_AI_PROVIDER_REVISION_ID,
  seedAiProviderFromEnv,
} from "./seed-ai-provider.js";

const ENCRYPTION_KEY = "a".repeat(64);
const API_KEY = "sk-test-secret-key";

const seedEnv = (
  overrides: Readonly<Record<string, string | undefined>> = {},
): Readonly<Record<string, string | undefined>> => ({
  DATABASE_URL: "postgresql://user:pass@localhost:5432/customreport_e2e",
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
  AI_PROVIDER_CONFIG_ENCRYPTION_KEY: ENCRYPTION_KEY,
  AI_PROVIDER_CONFIG_KEY_VERSION: "1",
  AI_PROVIDER_ALLOWED_ORIGINS:
    "https://provider.example.com,https://api.openai.com",
  REPORT_ASSISTANT_INPUT_VERSION: "1",
  E2E_AI_PROVIDER_API_KEY: API_KEY,
  E2E_AI_PROVIDER_BASE_URL: "https://provider.example.com/v1",
  E2E_AI_PROVIDER_MODEL: "test-chat-model",
  E2E_AI_PROVIDER_EMBEDDING_MODEL: "test-embed-model",
  E2E_AI_PROVIDER_EMBEDDING_DIMENSIONS: "1024",
  ...overrides,
});

interface SeedTx {
  aiProviderConfiguration: {
    upsert: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  aiProviderControl: {
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $executeRaw: ReturnType<typeof vi.fn>;
  aiPromptBundleRevision: { findFirst: ReturnType<typeof vi.fn> };
  aiFeaturePromptControl: {
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

const seedPrisma = (
  activeConfigurationId: string | null = null,
): { prisma: PrismaClient; tx: SeedTx } => {
  const tx: SeedTx = {
    aiProviderConfiguration: {
      upsert: vi.fn().mockResolvedValue({ id: SEED_AI_PROVIDER_REVISION_ID }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    aiProviderControl: {
      upsert: vi.fn().mockResolvedValue({ activeConfigurationId }),
      update: vi.fn().mockResolvedValue({}),
    },
    $executeRaw: vi.fn().mockResolvedValue(0),
    aiPromptBundleRevision: {
      findFirst: vi.fn().mockResolvedValue({ id: "existing" }),
    },
    aiFeaturePromptControl: {
      upsert: vi.fn().mockResolvedValue({ id: "control" }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (
        callback: (transaction: SeedTx) => Promise<unknown>,
      ): Promise<unknown> => callback(tx),
    ),
  } as unknown as PrismaClient;
  return { prisma, tx };
};

describe("seedAiProviderFromEnv", () => {
  it("no-ops without touching the database when E2E_AI_PROVIDER_API_KEY is unset", async () => {
    const { prisma } = seedPrisma();
    await expect(seedAiProviderFromEnv(prisma, {})).resolves.toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("no-ops when E2E_AI_PROVIDER_API_KEY is blank", async () => {
    const { prisma } = seedPrisma();
    await seedAiProviderFromEnv(prisma, { E2E_AI_PROVIDER_API_KEY: "  " });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates an active revision whose stored credential decrypts back to the env key", async () => {
    const { prisma, tx } = seedPrisma();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await seedAiProviderFromEnv(prisma, seedEnv());

    const upsert = tx.aiProviderConfiguration.upsert;
    expect(upsert).toHaveBeenCalledOnce();
    const { create, update } = upsert.mock.calls[0]?.[0] as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(create.id).toBe(SEED_AI_PROVIDER_REVISION_ID);
    expect(create.lifecycle).toBe("active");
    expect(create.generationProfile).toBe("custom_openai_compatible");
    expect(create.generationBaseUrl).toBe("https://provider.example.com/v1");
    expect(create.plannerModel).toBe("test-chat-model");
    expect(create.answerModel).toBe("test-chat-model");
    expect(create.embeddingMode).toBe("reuse_generation");
    expect(create.embeddingModel).toBe("test-embed-model");
    expect(create.embeddingDimensions).toBe(1024);
    expect(create.semanticInputVersion).toBe("1");
    expect(update.lifecycle).toBe("active");

    const codec = new AesGcmCredentialCodec(ENCRYPTION_KEY, 1);
    const decrypted = codec.decrypt(
      {
        ciphertext: create.generationCredentialCiphertext as string,
        nonce: create.generationCredentialNonce as string,
        tag: create.generationCredentialTag as string,
        keyVersion: create.generationCredentialKeyVersion as number,
        maskedSuffix: create.generationCredentialMaskedSuffix as string,
      },
      { revisionId: SEED_AI_PROVIDER_REVISION_ID, role: "generation" },
    );
    expect(decrypted).toBe(API_KEY);
    expect(create.generationCredentialMaskedSuffix).toMatch(/^••••/u);

    expect(tx.aiProviderControl.update).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: {
        enabled: true,
        activeConfigurationId: SEED_AI_PROVIDER_REVISION_ID,
      },
    });

    const persisted = JSON.stringify(upsert.mock.calls);
    const logged = JSON.stringify(log.mock.calls);
    expect(persisted).not.toContain(API_KEY);
    expect(logged).not.toContain(API_KEY);
    log.mockRestore();
  });

  it("refuses an unguarded target before touching the database", async () => {
    const { prisma, tx } = seedPrisma();
    await expect(
      seedAiProviderFromEnv(
        prisma,
        seedEnv({
          DATABASE_URL: "postgresql://user:pass@db.internal:5432/prod",
        }),
      ),
    ).rejects.toThrow(/Refusing/u);
    expect(tx.aiProviderConfiguration.upsert).not.toHaveBeenCalled();
  });

  it("refuses when the per-run consent token is missing", async () => {
    const { prisma, tx } = seedPrisma();
    await expect(
      seedAiProviderFromEnv(
        prisma,
        seedEnv({ PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: undefined }),
      ),
    ).rejects.toThrow(/PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION/u);
    expect(tx.aiProviderConfiguration.upsert).not.toHaveBeenCalled();
  });

  it("fails closed when a companion variable is missing", async () => {
    const { prisma, tx } = seedPrisma();
    await expect(
      seedAiProviderFromEnv(
        prisma,
        seedEnv({ E2E_AI_PROVIDER_BASE_URL: undefined }),
      ),
    ).rejects.toThrow(/E2E_AI_PROVIDER_BASE_URL/u);
    expect(tx.aiProviderConfiguration.upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric embedding dimension", async () => {
    const { prisma, tx } = seedPrisma();
    await expect(
      seedAiProviderFromEnv(
        prisma,
        seedEnv({ E2E_AI_PROVIDER_EMBEDDING_DIMENSIONS: "abc" }),
      ),
    ).rejects.toThrow(/E2E_AI_PROVIDER_EMBEDDING_DIMENSIONS/u);
    expect(tx.aiProviderConfiguration.upsert).not.toHaveBeenCalled();
  });

  it("supersedes a previously active revision when repointing the control", async () => {
    const previousId = "b0000000-0000-4000-8000-00000000b001";
    const { prisma, tx } = seedPrisma(previousId);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await seedAiProviderFromEnv(prisma, seedEnv());

    expect(tx.aiProviderConfiguration.updateMany).toHaveBeenCalledWith({
      where: { id: previousId, lifecycle: "active" },
      data: {
        lifecycle: "superseded",
        supersededAt: expect.any(Date) as unknown,
      },
    });
    log.mockRestore();
  });
});
