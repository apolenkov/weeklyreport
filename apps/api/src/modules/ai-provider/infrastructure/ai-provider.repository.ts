import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  AiProviderLifecycle,
  AiProviderProfile,
  type Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  aiProviderControlInclude,
  type AiProviderControlRecord,
  type AiProviderRevisionRecord,
  aiProviderRevisionSelect,
} from "./ai-provider.repository.select.js";
import type { EncryptedCredential } from "./credential-codec.js";

export type StoredAiProviderRevision = Readonly<{
  id: string;
  profile: AiProviderProfile;
  baseUrl: string;
  endpointIdentity: string;
  plannerModel: string;
  answerModel: string;
  embeddingModel: string;
  embeddingDimensions: number | null;
  semanticInputVersion: string;
  credentialCiphertext: string;
  credentialNonce: string;
  credentialTag: string;
  credentialKeyVersion: number;
  credentialMaskedSuffix: string;
  lifecycle: AiProviderLifecycle;
  testResult: Prisma.JsonValue | null;
  testedAt: Date | null;
  preparationCompleted: number;
  preparationTotal: number;
  preparationFailed: number;
  preparationStartedAt: Date | null;
  preparationFinishedAt: Date | null;
  preparationElapsedMs: number;
  activatedAt: Date | null;
  supersededAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type StoredAiProviderControl = Readonly<{
  id: string;
  activeConfigurationId: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  activeConfiguration: StoredAiProviderRevision | null;
  revisions: readonly StoredAiProviderRevision[];
}>;

export type NewAiProviderRevision = Readonly<{
  profile: AiProviderProfile;
  baseUrl: string;
  endpointIdentity: string;
  plannerModel: string;
  answerModel: string;
  embeddingModel: string;
  embeddingDimensions: number | null;
  semanticInputVersion: string;
  credential: EncryptedCredential;
}>;

const toRevision = (
  value: AiProviderRevisionRecord,
): StoredAiProviderRevision => value;

const toControl = (
  value: AiProviderControlRecord,
  revisions: readonly StoredAiProviderRevision[],
): StoredAiProviderControl => ({
  ...value,
  activeConfiguration: value.activeConfiguration
    ? toRevision(value.activeConfiguration)
    : null,
  revisions,
});

@Injectable()
export class AiProviderConfigurationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getControl(): Promise<StoredAiProviderControl | null> {
    const [control, revisions] = await Promise.all([
      this.prisma.aiProviderControl.findUnique({
        where: { id: "singleton" },
        include: aiProviderControlInclude,
      }),
      this.prisma.aiProviderConfiguration.findMany({
        select: aiProviderRevisionSelect,
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    ]);
    return control ? toControl(control, revisions.map(toRevision)) : null;
  }

  async getRevision(id: string): Promise<StoredAiProviderRevision | null> {
    const revision = await this.prisma.aiProviderConfiguration.findUnique({
      where: { id },
      select: aiProviderRevisionSelect,
    });
    return revision ? toRevision(revision) : null;
  }

  async hasAnyConfiguration(): Promise<boolean> {
    const [control, revision] = await Promise.all([
      this.prisma.aiProviderControl.findFirst({ select: { id: true } }),
      this.prisma.aiProviderConfiguration.findFirst({ select: { id: true } }),
    ]);
    return control !== null || revision !== null;
  }

  async createDraft(
    input: NewAiProviderRevision,
  ): Promise<StoredAiProviderRevision> {
    const revision = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.aiProviderConfiguration.create({
        data: {
          id: randomUUID(),
          profile: input.profile,
          baseUrl: input.baseUrl,
          endpointIdentity: input.endpointIdentity,
          plannerModel: input.plannerModel,
          answerModel: input.answerModel,
          embeddingModel: input.embeddingModel,
          embeddingDimensions: input.embeddingDimensions,
          semanticInputVersion: input.semanticInputVersion,
          credentialCiphertext: input.credential.ciphertext,
          credentialNonce: input.credential.nonce,
          credentialTag: input.credential.tag,
          credentialKeyVersion: input.credential.keyVersion,
          credentialMaskedSuffix: input.credential.maskedSuffix,
        },
        select: aiProviderRevisionSelect,
      });
      await transaction.aiProviderControl.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" },
      });
      return created;
    });
    return toRevision(revision);
  }

  async setTestResult(
    id: string,
    result: Prisma.InputJsonValue,
    passed: boolean,
    embeddingDimensions: number | null,
    testedAt: Date,
    currentLifecycle: AiProviderLifecycle,
  ): Promise<StoredAiProviderRevision> {
    const revision = await this.prisma.aiProviderConfiguration.update({
      where: { id },
      data: {
        lifecycle:
          currentLifecycle === AiProviderLifecycle.active
            ? AiProviderLifecycle.active
            : passed
              ? AiProviderLifecycle.validated
              : AiProviderLifecycle.failed,
        testResult: result,
        embeddingDimensions,
        testedAt,
      },
      select: aiProviderRevisionSelect,
    });
    return toRevision(revision);
  }

  async updateProgress(
    id: string,
    progress: Readonly<{
      completed: number;
      total: number;
      failed: number;
      elapsedMs: number;
      startedAt: Date | null;
      finishedAt: Date | null;
      lifecycle?: AiProviderLifecycle;
    }>,
  ): Promise<StoredAiProviderRevision> {
    const revision = await this.prisma.aiProviderConfiguration.update({
      where: { id },
      data: {
        preparationCompleted: progress.completed,
        preparationTotal: progress.total,
        preparationFailed: progress.failed,
        preparationElapsedMs: progress.elapsedMs,
        preparationStartedAt: progress.startedAt,
        preparationFinishedAt: progress.finishedAt,
        ...(progress.lifecycle ? { lifecycle: progress.lifecycle } : {}),
      },
      select: aiProviderRevisionSelect,
    });
    return toRevision(revision);
  }

  async activateRevision(id: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const control = await transaction.aiProviderControl.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" },
        select: { activeConfigurationId: true },
      });
      if (
        control.activeConfigurationId &&
        control.activeConfigurationId !== id
      ) {
        await transaction.aiProviderConfiguration.update({
          where: { id: control.activeConfigurationId },
          data: {
            lifecycle: AiProviderLifecycle.superseded,
            supersededAt: now,
          },
        });
      }
      await transaction.aiProviderConfiguration.update({
        where: { id },
        data: { lifecycle: AiProviderLifecycle.active, activatedAt: now },
      });
      await transaction.aiProviderControl.update({
        where: { id: "singleton" },
        data: { activeConfigurationId: id, enabled: true },
      });
    });
  }

  async disable(): Promise<void> {
    await this.prisma.aiProviderControl.upsert({
      where: { id: "singleton" },
      update: { enabled: false },
      create: { id: "singleton", enabled: false },
    });
  }
}
