import {
  AiProviderLifecycle,
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  AiProviderConfigurationRepository,
  type NewAiProviderRevision,
} from "./ai-provider.repository.js";

const revision = (
  id: string,
  lifecycle: AiProviderLifecycle = AiProviderLifecycle.draft,
) => ({
  id,
  generationProfile: AiProviderProfile.mistral,
  generationBaseUrl: "https://api.mistral.ai/v1",
  generationEndpointIdentity: "mistral:api",
  plannerModel: "mistral-large-latest",
  answerModel: "mistral-large-latest",
  embeddingModel: "mistral-embed",
  embeddingDimensions: 1024,
  semanticInputVersion: "report-assistant/v1",
  reasoningMode: AiProviderReasoningMode.provider_default,
  reasoningCustomValue: null,
  generationCredentialCiphertext: "ciphertext",
  generationCredentialNonce: "nonce",
  generationCredentialTag: "tag",
  generationCredentialKeyVersion: 1,
  generationCredentialMaskedSuffix: "••••abcd",
  embeddingMode: "reuse_generation" as const,
  embeddingProfile: null,
  embeddingBaseUrl: null,
  embeddingEndpointIdentity: null,
  embeddingCredentialCiphertext: null,
  embeddingCredentialNonce: null,
  embeddingCredentialTag: null,
  embeddingCredentialKeyVersion: null,
  embeddingCredentialMaskedSuffix: null,
  generationCompatibilityIdentity: "generation-identity",
  embeddingScopeIdentity: "embedding-identity",
  compositeTestIdentity: "composite-identity",
  lifecycle,
  testResult: null,
  testExecutions: [],
  testedAt: null,
  preparationCompleted: 0,
  preparationTotal: 0,
  preparationFailed: 0,
  preparationStartedAt: new Date("2026-08-10T00:00:00.000Z"),
  preparationFinishedAt: new Date("2026-08-10T00:00:01.000Z"),
  preparationElapsedMs: 0,
  preparationSourceFingerprint: "source-fingerprint",
  preparationSourceGeneration: 0n,
  activatedAt: null,
  supersededAt: null,
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
});

const passingTestResult = {
  status: "passed",
  generation: {
    status: "passed",
    capabilities: [{ capability: "authentication", status: "passed" }],
  },
  embeddings: {
    status: "passed",
    capabilities: [{ capability: "batch_embeddings", status: "passed" }],
  },
  testedAt: "2026-08-10T00:00:00.000Z",
};

const encryptedCredential = {
  ciphertext: "ciphertext",
  nonce: "nonce",
  tag: "tag",
  keyVersion: 1,
  maskedSuffix: "••••abcd",
} as const;

const draft = {
  id: "revision-new",
  generation: {
    profile: AiProviderProfile.mistral,
    baseUrl: "https://api.mistral.ai/v1",
    endpointIdentity: "mistral:api",
    credential: encryptedCredential,
  },
  plannerModel: "mistral-large-latest",
  answerModel: "mistral-large-latest",
  reasoningMode: AiProviderReasoningMode.provider_default,
  reasoningCustomValue: null,
  embeddings: {
    mode: "reuse_generation",
    model: "mistral-embed",
    dimensions: 1024,
    semanticInputVersion: "report-assistant/v1",
  },
  generationCompatibilityIdentity: "generation-identity",
  embeddingScopeIdentity: "embedding-identity",
  compositeTestIdentity: "composite-identity",
} satisfies NewAiProviderRevision;

type RevisionRecord = ReturnType<typeof revision>;
type CreateInput = Readonly<{ data: Readonly<Record<string, unknown>> }>;

const buildHarness = () => {
  const active = revision("revision-active", AiProviderLifecycle.active);
  const candidate = {
    ...revision("revision-new", AiProviderLifecycle.validated),
    testResult: passingTestResult,
    testedAt: new Date("2026-08-10T00:00:00.000Z"),
  };
  const controlUpsert = vi
    .fn<(input: unknown) => Promise<unknown>>()
    .mockResolvedValue({
      activeConfigurationId: "revision-old",
    });
  const controlUpdate = vi
    .fn<(input: unknown) => Promise<void>>()
    .mockResolvedValue(undefined);
  const revisionCreate = vi
    .fn<(input: CreateInput) => Promise<RevisionRecord>>()
    .mockResolvedValue(revision("revision-new"));
  const revisionUpdate = vi
    .fn<(input: unknown) => Promise<RevisionRecord>>()
    .mockResolvedValue(active);
  const revisionUpdateMany = vi
    .fn<(input: unknown) => Promise<{ count: number }>>()
    .mockResolvedValue({ count: 1 });
  const controlUpdateMany = vi
    .fn<(input: unknown) => Promise<{ count: number }>>()
    .mockResolvedValue({ count: 1 });
  const configurationDeleteMany = vi
    .fn<(input: unknown) => Promise<{ count: number }>>()
    .mockResolvedValue({ count: 1 });
  const controlFindFirst = vi
    .fn<() => Promise<{ id: string }>>()
    .mockResolvedValue({ id: "singleton" });
  const configurationFindMany = vi
    .fn<() => Promise<readonly RevisionRecord[]>>()
    .mockResolvedValue([active, revision("revision-old")]);
  const controlFindUnique = vi.fn().mockResolvedValue({
    id: "singleton",
    activeConfigurationId: active.id,
    enabled: true,
    createdAt: active.createdAt,
    updatedAt: active.updatedAt,
    activeConfiguration: active,
  });
  const transaction = {
    aiProviderConfiguration: {
      create: revisionCreate,
      findUnique: vi
        .fn()
        .mockImplementation(
          (input: Readonly<{ where: Readonly<{ id: string }> }>) =>
            Promise.resolve(
              input.where.id === candidate.id ? candidate : active,
            ),
        ),
      findUniqueOrThrow: vi.fn().mockResolvedValue(candidate),
      findMany: configurationFindMany,
      update: revisionUpdate,
      updateMany: revisionUpdateMany,
      deleteMany: configurationDeleteMany,
    },
    aiProviderControl: {
      findUnique: controlFindUnique,
      upsert: controlUpsert,
      update: controlUpdate,
      updateMany: controlUpdateMany,
    },
    aiProviderTestExecution: {
      findFirst: vi.fn().mockResolvedValue({ id: "execution-current" }),
    },
    semanticSourceState: {
      upsert: vi.fn().mockResolvedValue({ generation: 0n }),
    },
    $queryRaw: vi
      .fn()
      .mockImplementation((strings: TemplateStringsArray, id: string) =>
        Promise.resolve(
          strings.join("").includes('SELECT "lifecycle"')
            ? [
                {
                  lifecycle:
                    id === candidate.id
                      ? candidate.lifecycle
                      : active.lifecycle,
                },
              ]
            : [{ generation: 0n }],
        ),
      ),
  };
  const transactionRunner = vi.fn(
    (callback: (value: typeof transaction) => unknown) =>
      Promise.resolve(callback(transaction)),
  );
  const prisma = {
    $transaction: transactionRunner,
    aiProviderControl: {
      findUnique: controlFindUnique,
      findFirst: controlFindFirst,
      upsert: controlUpsert,
    },
    aiProviderConfiguration: {
      findMany: configurationFindMany,
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(active),
      update: revisionUpdate,
      deleteMany: configurationDeleteMany,
    },
  } as unknown as PrismaService;
  return {
    prisma,
    repository: new AiProviderConfigurationRepository(prisma),
    controlUpsert,
    controlUpdate,
    revisionCreate,
    revisionUpdate,
    revisionUpdateMany,
    controlUpdateMany,
    transaction,
    candidate,
    controlFindFirst,
    configurationFindMany,
    configurationUpdate: revisionUpdate,
    configurationDeleteMany,
    transactionRunner,
  };
};

describe("AiProviderConfigurationRepository", () => {
  it("conditionally deletes only disposable lifecycle rows", async () => {
    const harness = buildHarness();

    await expect(
      harness.repository.discardDisposable("revision-draft"),
    ).resolves.toBe(true);
    expect(harness.configurationDeleteMany).toHaveBeenCalledWith({
      where: {
        id: "revision-draft",
        lifecycle: {
          in: [AiProviderLifecycle.draft, AiProviderLifecycle.failed],
        },
      },
    });
  });

  it("reports a concurrent lifecycle change without deleting a row", async () => {
    const harness = buildHarness();
    harness.configurationDeleteMany.mockResolvedValue({ count: 0 });

    await expect(
      harness.repository.discardDisposable("revision-raced"),
    ).resolves.toBe(false);
  });
  it("reads the active revision and retained revisions without credentials in the control shape", async () => {
    const harness = buildHarness();

    const result = await harness.repository.getControl();

    expect(result?.activeConfiguration?.id).toBe("revision-active");
    expect(result?.revisions.map(({ id }) => id)).toEqual([
      "revision-active",
      "revision-old",
    ]);
    expect(harness.configurationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, orderBy: { updatedAt: "desc" } }),
    );
    expect(harness.transactionRunner).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "RepeatableRead" },
    );
  });

  it("persists a new encrypted revision and initializes the singleton in one transaction", async () => {
    const harness = buildHarness();

    await harness.repository.createDraft(draft);

    expect(harness.transactionRunner).toHaveBeenCalledTimes(1);
    const created = harness.revisionCreate.mock.calls[0]?.[0];
    expect(created?.data).toMatchObject({
      generationCredentialCiphertext: encryptedCredential.ciphertext,
      generationCredentialNonce: encryptedCredential.nonce,
      generationCredentialTag: encryptedCredential.tag,
      generationCredentialKeyVersion: encryptedCredential.keyVersion,
      generationCredentialMaskedSuffix: encryptedCredential.maskedSuffix,
      embeddingMode: "reuse_generation",
    });
    expect(harness.controlUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "singleton" } }),
    );
  });

  it("supersedes the previous revision before atomically moving the active pointer", async () => {
    const harness = buildHarness();
    const activatedAt = new Date("2026-08-10T01:00:00.000Z");

    await harness.repository.activateRevision("revision-new", activatedAt, {
      mode: "prepared",
      sourceFingerprint: "source-fingerprint",
      sourceGeneration: 0n,
    });

    expect(harness.transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(harness.revisionUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "revision-old",
        lifecycle: AiProviderLifecycle.active,
      },
      data: {
        lifecycle: AiProviderLifecycle.superseded,
        supersededAt: activatedAt,
      },
    });
    expect(harness.revisionUpdateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "revision-new",
        lifecycle: {
          in: [
            AiProviderLifecycle.validated,
            AiProviderLifecycle.preparing,
            AiProviderLifecycle.active,
            AiProviderLifecycle.superseded,
          ],
        },
      },
      data: {
        preparationCompleted: 0,
        preparationTotal: 0,
        preparationFailed: 0,
        preparationStartedAt: new Date("2026-08-10T00:00:00.000Z"),
        preparationFinishedAt: new Date("2026-08-10T00:00:01.000Z"),
        preparationElapsedMs: 0,
        preparationSourceFingerprint: "source-fingerprint",
        preparationSourceGeneration: 0n,
        lifecycle: AiProviderLifecycle.active,
        activatedAt,
      },
    });
    expect(harness.controlUpdateMany).toHaveBeenCalledWith({
      where: { id: "singleton", activeConfigurationId: "revision-old" },
      data: { activeConfigurationId: "revision-new", enabled: true },
    });
  });

  it("reports a concurrent active-pointer change without committing activation", async () => {
    const harness = buildHarness();
    harness.controlUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      harness.repository.activateRevision(
        "revision-new",
        new Date("2026-08-10T01:00:00.000Z"),
        {
          mode: "prepared",
          sourceFingerprint: "source-fingerprint",
          sourceGeneration: 0n,
        },
      ),
    ).resolves.toBe(false);
  });

  it("activates from provider test evidence without prompt checks", async () => {
    const harness = buildHarness();
    const resultWithoutPromptChecks = await harness.repository.activateRevision(
      "revision-new",
      new Date("2026-08-10T01:00:00.000Z"),
      {
        mode: "prepared",
        sourceFingerprint: "source-fingerprint",
        sourceGeneration: 0n,
      },
    );
    expect(resultWithoutPromptChecks).toBe(true);
    expect(harness.controlUpdateMany).toHaveBeenCalledOnce();
  });

  it("copies current-scope readiness while atomically moving the active pointer", async () => {
    const harness = buildHarness();
    const activatedAt = new Date("2026-08-10T01:00:00.000Z");
    harness.controlUpsert.mockResolvedValue({
      activeConfigurationId: "revision-active",
    });

    await expect(
      harness.repository.activateRevision("revision-new", activatedAt, {
        mode: "reuse_active_scope",
        activeRevisionId: "revision-active",
        sourceFingerprint: "source-fingerprint",
        sourceGeneration: 0n,
      }),
    ).resolves.toBe(true);

    expect(harness.transaction.$queryRaw).not.toHaveBeenCalled();
    expect(
      harness.transaction.aiProviderConfiguration.findUnique,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: "revision-active" } }),
    );
    const activationUpdate = harness.revisionUpdateMany.mock.calls[1]?.[0] as {
      where: Readonly<{ id: string }>;
      data: Readonly<Record<string, unknown>>;
    };
    expect(activationUpdate.where.id).toBe("revision-new");
    expect(activationUpdate.data).toMatchObject({
      preparationCompleted: 0,
      preparationTotal: 0,
      preparationFailed: 0,
      preparationStartedAt: new Date("2026-08-10T00:00:00.000Z"),
      preparationFinishedAt: new Date("2026-08-10T00:00:01.000Z"),
      preparationElapsedMs: 0,
      preparationSourceFingerprint: "source-fingerprint",
      preparationSourceGeneration: 0n,
      lifecycle: AiProviderLifecycle.active,
      activatedAt,
    });
    expect(harness.controlUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "singleton",
        activeConfigurationId: "revision-active",
      },
      data: { activeConfigurationId: "revision-new", enabled: true },
    });
  });

  it("preserves active lifecycle while recording a failed capability retest", async () => {
    const harness = buildHarness();
    const testedAt = new Date("2026-08-10T01:00:00.000Z");

    await harness.repository.setTestResult({
      id: "revision-active",
      result: { status: "failed" },
      status: "failed",
      embeddingDimensions: null,
      testedAt,
      currentLifecycle: AiProviderLifecycle.active,
    });

    const update = harness.configurationUpdate.mock.calls[0]?.[0] as {
      data: {
        lifecycle: AiProviderLifecycle;
        testResult: { status: "failed" };
        embeddingDimensions?: number | null;
        testedAt: Date;
      };
      select: object;
    };
    expect(update.data.lifecycle).toBe(AiProviderLifecycle.active);
    expect(update.data.testResult).toEqual({ status: "failed" });
    expect(update.data).not.toHaveProperty("embeddingDimensions");
    expect(update.data).not.toHaveProperty("generationCompatibilityIdentity");
    expect(update.data).not.toHaveProperty("embeddingScopeIdentity");
    expect(update.data).not.toHaveProperty("compositeTestIdentity");
    expect(update.data.testedAt).toBe(testedAt);
    expect(typeof update.select).toBe("object");
  });

  it("returns an inconclusive non-active revision to draft", async () => {
    const harness = buildHarness();

    await harness.repository.setTestResult({
      id: "revision-new",
      result: { status: "inconclusive" },
      status: "inconclusive",
      embeddingDimensions: null,
      testedAt: new Date("2026-08-10T01:00:00.000Z"),
      currentLifecycle: AiProviderLifecycle.failed,
    });

    const update = harness.configurationUpdate.mock.calls.at(-1)?.[0] as {
      data?: Readonly<Record<string, unknown>>;
    };
    expect(update.data?.lifecycle).toBe(AiProviderLifecycle.draft);
  });

  it("disables the singleton without deleting retained revisions", async () => {
    const harness = buildHarness();

    await harness.repository.disable();

    expect(harness.controlFindFirst).not.toHaveBeenCalled();
    expect(harness.controlUpsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      update: { enabled: false },
      create: { id: "singleton", enabled: false },
    });
    expect(harness.configurationUpdate).not.toHaveBeenCalled();
  });
});
