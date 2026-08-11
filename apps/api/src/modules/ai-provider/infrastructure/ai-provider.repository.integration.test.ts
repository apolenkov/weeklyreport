import { AiProviderLifecycle, AiProviderProfile } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import { AiProviderConfigurationRepository } from "./ai-provider.repository.js";

const prisma = createTestPrisma();
const repository = new AiProviderConfigurationRepository(
  prisma as unknown as PrismaService,
);

const revision = (
  id: string,
  lifecycle: AiProviderLifecycle,
  progress: Readonly<{
    completed?: number;
    total?: number;
    failed?: number;
  }> = {},
) =>
  prisma.aiProviderConfiguration.create({
    data: {
      id,
      profile: AiProviderProfile.mistral,
      baseUrl: "https://api.mistral.ai/v1",
      endpointIdentity: "mistral:stable-endpoint",
      plannerModel: "planner",
      answerModel: "answer",
      embeddingModel: "embed",
      embeddingDimensions: 3,
      semanticInputVersion: "report-assistant/v1",
      credentialCiphertext: "ciphertext",
      credentialNonce: "nonce",
      credentialTag: "tag",
      credentialKeyVersion: 1,
      credentialMaskedSuffix: "••••abcd",
      lifecycle,
      preparationCompleted: progress.completed ?? 0,
      preparationTotal: progress.total ?? 0,
      preparationFailed: progress.failed ?? 0,
      preparationElapsedMs: 25,
    },
  });

const createControl = (
  activeConfigurationId: string | null,
  enabled: boolean,
) =>
  prisma.aiProviderControl.create({
    data: { id: "singleton", activeConfigurationId, enabled },
  });

describe("AI provider control-plane database states", () => {
  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("represents unconfigured and disabled states without deleting revisions", async () => {
    await expect(repository.getControl()).resolves.toBeNull();

    const active = await revision(
      "a0000000-0000-4000-8000-000000000001",
      AiProviderLifecycle.active,
    );
    await createControl(active.id, false);

    await expect(repository.getControl()).resolves.toMatchObject({
      enabled: false,
      activeConfigurationId: active.id,
      activeConfiguration: { lifecycle: AiProviderLifecycle.active },
      revisions: [{ id: active.id }],
    });
  });

  it("round-trips bootstrapped, preparing, failed, and superseded revisions", async () => {
    const active = await revision(
      "a0000000-0000-4000-8000-000000000002",
      AiProviderLifecycle.active,
    );
    const superseded = await revision(
      "a0000000-0000-4000-8000-000000000003",
      AiProviderLifecycle.superseded,
    );
    const preparing = await revision(
      "a0000000-0000-4000-8000-000000000004",
      AiProviderLifecycle.preparing,
      { completed: 4, total: 9 },
    );
    const failed = await revision(
      "a0000000-0000-4000-8000-000000000005",
      AiProviderLifecycle.failed,
      { completed: 4, total: 9, failed: 1 },
    );
    await createControl(active.id, true);

    const stored = await repository.getControl();

    expect(stored?.activeConfiguration?.id).toBe(active.id);
    expect(stored?.revisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: active.id, lifecycle: "active" }),
        expect.objectContaining({
          id: superseded.id,
          lifecycle: "superseded",
        }),
        expect.objectContaining({
          id: preparing.id,
          lifecycle: "preparing",
          preparationCompleted: 4,
          preparationTotal: 9,
        }),
        expect.objectContaining({
          id: failed.id,
          lifecycle: "failed",
          preparationFailed: 1,
        }),
      ]),
    );
  });
});
