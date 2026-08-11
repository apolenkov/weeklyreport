import { AiProviderLifecycle, AiProviderProfile } from "@prisma/client";
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
  profile: AiProviderProfile.mistral,
  baseUrl: "https://api.mistral.ai/v1",
  endpointIdentity: "mistral:api",
  plannerModel: "mistral-large-latest",
  answerModel: "mistral-large-latest",
  embeddingModel: "mistral-embed",
  embeddingDimensions: 1024,
  semanticInputVersion: "report-assistant/v1",
  credentialCiphertext: "ciphertext",
  credentialNonce: "nonce",
  credentialTag: "tag",
  credentialKeyVersion: 1,
  credentialMaskedSuffix: "••••abcd",
  lifecycle,
  testResult: null,
  testedAt: null,
  preparationCompleted: 0,
  preparationTotal: 0,
  preparationFailed: 0,
  preparationStartedAt: null,
  preparationFinishedAt: null,
  preparationElapsedMs: 0,
  activatedAt: null,
  supersededAt: null,
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
});

const encryptedCredential = {
  ciphertext: "ciphertext",
  nonce: "nonce",
  tag: "tag",
  keyVersion: 1,
  maskedSuffix: "••••abcd",
} as const;

const draft = {
  profile: AiProviderProfile.mistral,
  baseUrl: "https://api.mistral.ai/v1",
  endpointIdentity: "mistral:api",
  plannerModel: "mistral-large-latest",
  answerModel: "mistral-large-latest",
  embeddingModel: "mistral-embed",
  embeddingDimensions: 1024,
  semanticInputVersion: "report-assistant/v1",
  credential: encryptedCredential,
} satisfies NewAiProviderRevision;

type RevisionRecord = ReturnType<typeof revision>;
type CreateInput = Readonly<{ data: Readonly<Record<string, unknown>> }>;

const buildHarness = () => {
  const active = revision("revision-active", AiProviderLifecycle.active);
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
  const controlFindFirst = vi
    .fn<() => Promise<{ id: string }>>()
    .mockResolvedValue({ id: "singleton" });
  const configurationFindMany = vi
    .fn<() => Promise<readonly RevisionRecord[]>>()
    .mockResolvedValue([active, revision("revision-old")]);
  const transaction = {
    aiProviderConfiguration: {
      create: revisionCreate,
      update: revisionUpdate,
    },
    aiProviderControl: {
      upsert: controlUpsert,
      update: controlUpdate,
    },
  };
  const transactionRunner = vi.fn(
    (callback: (value: typeof transaction) => unknown) =>
      Promise.resolve(callback(transaction)),
  );
  const prisma = {
    $transaction: transactionRunner,
    aiProviderControl: {
      findUnique: vi.fn().mockResolvedValue({
        id: "singleton",
        activeConfigurationId: active.id,
        enabled: true,
        createdAt: active.createdAt,
        updatedAt: active.updatedAt,
        activeConfiguration: active,
      }),
      findFirst: controlFindFirst,
      upsert: controlUpsert,
    },
    aiProviderConfiguration: {
      findMany: configurationFindMany,
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(active),
      update: revisionUpdate,
    },
  } as unknown as PrismaService;
  return {
    prisma,
    repository: new AiProviderConfigurationRepository(prisma),
    controlUpsert,
    controlUpdate,
    revisionCreate,
    revisionUpdate,
    transaction,
    controlFindFirst,
    configurationFindMany,
    configurationUpdate: revisionUpdate,
    transactionRunner,
  };
};

describe("AiProviderConfigurationRepository", () => {
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
  });

  it("persists a new encrypted revision and initializes the singleton in one transaction", async () => {
    const harness = buildHarness();

    await harness.repository.createDraft(draft);

    expect(harness.transactionRunner).toHaveBeenCalledTimes(1);
    const created = harness.revisionCreate.mock.calls[0]?.[0];
    expect(created?.data).toMatchObject({
      credentialCiphertext: encryptedCredential.ciphertext,
      credentialNonce: encryptedCredential.nonce,
      credentialTag: encryptedCredential.tag,
      credentialKeyVersion: encryptedCredential.keyVersion,
      credentialMaskedSuffix: encryptedCredential.maskedSuffix,
    });
    expect(harness.controlUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "singleton" } }),
    );
  });

  it("supersedes the previous revision before atomically moving the active pointer", async () => {
    const harness = buildHarness();
    const activatedAt = new Date("2026-08-10T01:00:00.000Z");

    await harness.repository.activateRevision("revision-new", activatedAt);

    expect(harness.revisionUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "revision-old" },
      data: {
        lifecycle: AiProviderLifecycle.superseded,
        supersededAt: activatedAt,
      },
    });
    expect(harness.revisionUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "revision-new" },
      data: { lifecycle: AiProviderLifecycle.active, activatedAt },
    });
    expect(harness.controlUpdate).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: { activeConfigurationId: "revision-new", enabled: true },
    });
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
