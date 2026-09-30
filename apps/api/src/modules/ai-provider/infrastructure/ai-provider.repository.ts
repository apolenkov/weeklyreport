import type {
  AiProviderCapabilityTestResult,
  AiProviderTestOutcome,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import {
  AiProviderLifecycle,
  AiProviderProfile,
  AiProviderReasoningMode,
  type Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  activateAiProviderRevision,
  type AiProviderActivationReadiness,
} from "./ai-provider.repository.activation.js";
import {
  type AiProviderPreparationUpdate,
  createDraftRecord,
  type NewAiProviderRevision,
  type SetClaimedTestResultInput,
  setClaimedTestResultRecord,
  setTestResultRecord,
  updateProgressRecord,
} from "./ai-provider.repository.commands.js";
import {
  completeProviderTestExecution,
  createOrReuseProviderExecution,
  getProviderTestExecution,
  type ProviderExecutionRequest,
  startProviderTestExecution,
} from "./ai-provider.repository.executions.js";
import {
  aiProviderControlInclude,
  type AiProviderControlRecord,
  type AiProviderRevisionRecord,
  aiProviderRevisionSelect,
} from "./ai-provider.repository.select.js";

export type { AiProviderActivationReadiness } from "./ai-provider.repository.activation.js";
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
    testSuiteVersion: string;
    state: "queued" | "running" | "completed";
    outcome: AiProviderTestOutcome | null;
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
  preparationSourceFingerprint?: string | null;
  preparationSourceGeneration?: bigint | null;
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
  latestExecution: value.testExecutions[0] ?? null,
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
    identities?: Readonly<{
      generationCompatibilityIdentity: string;
      embeddingScopeIdentity: string;
      compositeTestIdentity: string;
    }>,
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

  async setClaimedTestResult(
    input: SetClaimedTestResultInput,
  ): Promise<StoredAiProviderRevision | null> {
    const tested = await setClaimedTestResultRecord(this.prisma, input);
    return tested ? toRevision(tested) : null;
  }

  async createOrReuseProviderExecution(
    revisionId: string,
    input: ProviderExecutionRequest,
  ): ReturnType<typeof createOrReuseProviderExecution> {
    return createOrReuseProviderExecution(this.prisma, revisionId, input);
  }

  async startExecution(id: string, executionAttempt = 1): Promise<boolean> {
    return startProviderTestExecution(this.prisma, id, executionAttempt);
  }

  async completeExecution(
    id: string,
    outcome: AiProviderTestOutcome,
    failureCode: string | null = null,
    checks: Prisma.InputJsonValue = [],
    executionAttempt = 1,
  ): Promise<boolean> {
    return completeProviderTestExecution(
      this.prisma,
      id,
      outcome,
      failureCode,
      checks,
      executionAttempt,
    );
  }

  async getExecution(id: string): ReturnType<typeof getProviderTestExecution> {
    return getProviderTestExecution(this.prisma, id);
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
    readiness: AiProviderActivationReadiness,
  ): Promise<boolean> {
    return activateAiProviderRevision(this.prisma, id, now, readiness);
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
