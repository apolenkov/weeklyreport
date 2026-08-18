import type { AiProviderCapabilityTestResult } from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import {
  type AiProviderAnswerProtocol,
  AiProviderLifecycle,
  AiProviderProfile,
  AiProviderReasoningMode,
  type Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { activateAiProviderRevision } from "./ai-provider.repository.activation.js";
import {
  type AiProviderPreparationUpdate,
  createDraftRecord,
  type NewAiProviderRevision,
  setTestResultRecord,
  updateProgressRecord,
} from "./ai-provider.repository.commands.js";
import {
  completeCompatibilityExecution,
  createOrReuseProviderExecution,
  getCompatibilityExecution,
  type ProviderExecutionRequest,
  startCompatibilityExecution,
  updateProviderExecutionIdentity,
} from "./ai-provider.repository.executions.js";
import {
  aiProviderControlInclude,
  type AiProviderControlRecord,
  type AiProviderRevisionRecord,
  aiProviderRevisionSelect,
} from "./ai-provider.repository.select.js";

export type { NewAiProviderRevision } from "./ai-provider.repository.commands.js";

export type StoredAiProviderRevision = Readonly<{
  id: string;
  generationProfile: AiProviderProfile;
  generationBaseUrl: string;
  generationEndpointIdentity: string;
  plannerModel: string;
  answerModel: string;
  reasoningMode: AiProviderReasoningMode;
  reasoningCustomValue: string | null;
  answerProtocol: AiProviderAnswerProtocol | null;
  generationCredentialCiphertext: string;
  generationCredentialNonce: string;
  generationCredentialTag: string;
  generationCredentialKeyVersion: number;
  generationCredentialMaskedSuffix: string;
  embeddingMode: "reuse_generation" | "separate";
  embeddingProfile: AiProviderProfile | null;
  embeddingBaseUrl: string | null;
  embeddingEndpointIdentity: string | null;
  embeddingModel: string;
  embeddingDimensions: number | null;
  embeddingCredentialCiphertext: string | null;
  embeddingCredentialNonce: string | null;
  embeddingCredentialTag: string | null;
  embeddingCredentialKeyVersion: number | null;
  embeddingCredentialMaskedSuffix: string | null;
  semanticInputVersion: string;
  generationCompatibilityIdentity: string;
  embeddingScopeIdentity: string;
  compositeTestIdentity: string;
  lifecycle: AiProviderLifecycle;
  testResult: Prisma.JsonValue | null;
  latestExecution?: Readonly<{
    id: string;
    state: "queued" | "running" | "completed";
    outcome:
      "passed" | "incompatible" | "configuration_error" | "inconclusive" | null;
    failureCode: string | null;
    checks: Prisma.JsonValue | null;
    requestedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }> | null;
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

const toRevision = (
  value: AiProviderRevisionRecord,
): StoredAiProviderRevision => ({
  ...value,
  latestExecution: value.compatibilityExecutions[0] ?? null,
});

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
    return toRevision(await createDraftRecord(this.prisma, input));
  }

  async setTestResult(
    id: string,
    result: Prisma.InputJsonValue,
    status: AiProviderCapabilityTestResult["status"],
    embeddingDimensions: number | null,
    testedAt: Date,
    currentLifecycle: AiProviderLifecycle,
    identities:
      | Readonly<{
          generationCompatibilityIdentity: string;
          embeddingScopeIdentity: string;
          compositeTestIdentity: string;
        }>
      | undefined = undefined,
  ): Promise<StoredAiProviderRevision> {
    return toRevision(
      await setTestResultRecord(this.prisma, {
        id,
        result,
        status,
        embeddingDimensions,
        testedAt,
        currentLifecycle,
        ...identities,
      }),
    );
  }

  async createOrReuseProviderExecution(
    revisionId: string,
    input: ProviderExecutionRequest,
  ): Promise<Readonly<{ id: string; created: boolean }>> {
    return createOrReuseProviderExecution(this.prisma, revisionId, input);
  }

  async startExecution(id: string): Promise<boolean> {
    return startCompatibilityExecution(this.prisma, id);
  }

  async updateExecutionIdentity(
    id: string,
    identity: string,
    revisionId: string,
  ): Promise<boolean> {
    return updateProviderExecutionIdentity(
      this.prisma,
      id,
      identity,
      revisionId,
    );
  }

  async completeExecution(
    id: string,
    outcome: "passed" | "incompatible" | "configuration_error" | "inconclusive",
    failureCode: string | null = null,
    checks: Prisma.InputJsonValue = [],
  ): Promise<void> {
    await completeCompatibilityExecution(
      this.prisma,
      id,
      outcome,
      failureCode,
      checks,
    );
  }

  async getExecution(id: string): ReturnType<typeof getCompatibilityExecution> {
    return getCompatibilityExecution(this.prisma, id);
  }

  async updateProgress(
    id: string,
    progress: AiProviderPreparationUpdate,
  ): Promise<StoredAiProviderRevision> {
    return toRevision(await updateProgressRecord(this.prisma, id, progress));
  }

  async activateRevision(
    id: string,
    now: Date,
    options: Readonly<{
      allowBootstrap?: boolean;
      promptEvaluatorVersions?: Readonly<Record<string, string>>;
    }> = {},
  ): Promise<boolean> {
    return activateAiProviderRevision(this.prisma, id, now, options);
  }

  async disable(): Promise<void> {
    await this.prisma.aiProviderControl.upsert({
      where: { id: "singleton" },
      update: { enabled: false },
      create: { id: "singleton", enabled: false },
    });
  }

  async discardDisposable(id: string): Promise<boolean> {
    const result = await this.prisma.aiProviderConfiguration.deleteMany({
      where: {
        id,
        lifecycle: {
          in: [AiProviderLifecycle.draft, AiProviderLifecycle.failed],
        },
      },
    });
    return result.count === 1;
  }
}
