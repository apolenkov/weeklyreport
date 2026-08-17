import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { AiPromptBundleLifecycle } from "@prisma/client";
import { AiCompatibilityExecutionKind } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  bootstrap,
  createDraft,
  recordEvaluation,
} from "./ai-prompt.repository.commands.js";
import {
  activate,
  discardDisposable,
  transition,
} from "./ai-prompt.repository.lifecycle.js";
import {
  type AiPromptActivationCompatibility,
  type AiPromptEvaluationLookup,
  evaluationSelect,
  type NewAiPromptBootstrap,
  type NewAiPromptBundleRevision,
  type NewAiPromptEvaluation,
  revisionSelect,
  revisionWhere,
  type StoredAiFeaturePromptControl,
  type StoredAiPromptBundleRevision,
  type StoredAiPromptEvaluation,
  toControl,
  toEvaluation,
  toRevision,
} from "./ai-prompt.repository.types.js";

export type {
  AiPromptActivationCompatibility,
  AiPromptEvaluationLookup,
  NewAiPromptBootstrap,
  NewAiPromptBundleRevision,
  NewAiPromptEvaluation,
  StoredAiFeaturePromptControl,
  StoredAiPromptBundleRevision,
  StoredAiPromptEvaluation,
} from "./ai-prompt.repository.types.js";

const PROMPT_HISTORY_LIMIT = 100;

export type PromptExecutionRequest = Readonly<{
  identity: string;
  featureKey: string;
  providerRevisionId: string;
  generationCompatibilityIdentity: string;
  contentHash: string;
  contractVersion: string;
  evaluatorVersion: string;
}>;

@Injectable()
export class AiPromptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureFeatureControl(featureKey: string): Promise<void> {
    await this.prisma.aiFeaturePromptControl.upsert({
      where: { featureKey },
      update: {},
      create: { id: randomUUID(), featureKey },
    });
  }

  async getControl(
    featureKey: string,
  ): Promise<StoredAiFeaturePromptControl | null> {
    const control = await this.prisma.aiFeaturePromptControl.findUnique({
      where: { featureKey },
      include: { activeRevision: { select: revisionSelect } },
    });
    if (!control) return null;
    const history = await this.prisma.aiPromptBundleRevision.findMany({
      where: { featureKey },
      select: revisionSelect,
      orderBy: { revision: "desc" },
      take: PROMPT_HISTORY_LIMIT,
    });
    return {
      ...toControl(control),
      latestRevision: history[0] ? toRevision(history[0]) : null,
      history: history.map(toRevision),
    };
  }

  async getRevision(
    featureKey: string,
    revisionId: string,
  ): Promise<StoredAiPromptBundleRevision | null> {
    const revision = await this.prisma.aiPromptBundleRevision.findFirst({
      where: revisionWhere(featureKey, revisionId),
      select: revisionSelect,
    });
    return revision ? toRevision(revision) : null;
  }

  async listRevisions(
    featureKey: string,
    take = PROMPT_HISTORY_LIMIT,
  ): Promise<readonly StoredAiPromptBundleRevision[]> {
    const revisions = await this.prisma.aiPromptBundleRevision.findMany({
      where: { featureKey },
      select: revisionSelect,
      orderBy: { revision: "desc" },
      take,
    });
    return revisions.map(toRevision);
  }

  createDraft(
    input: NewAiPromptBundleRevision,
  ): Promise<StoredAiPromptBundleRevision> {
    return createDraft(this.prisma, input);
  }

  bootstrap(
    input: NewAiPromptBootstrap,
  ): Promise<StoredAiPromptBundleRevision | null> {
    return bootstrap(this.prisma, input);
  }

  recordEvaluation(
    input: NewAiPromptEvaluation,
  ): Promise<StoredAiPromptEvaluation> {
    return recordEvaluation(this.prisma, input);
  }

  async findEvaluation(
    input: AiPromptEvaluationLookup,
  ): Promise<StoredAiPromptEvaluation | null> {
    const evaluation = await this.prisma.aiPromptEvaluation.findUnique({
      where: {
        promptRevisionId_generationCompatibilityIdentity_contentHash_contractVersion_evaluatorVersion:
          input,
      },
      select: evaluationSelect,
    });
    return evaluation ? toEvaluation(evaluation) : null;
  }

  async createOrReusePromptExecution(
    promptRevisionId: string,
    input: PromptExecutionRequest,
  ): Promise<Readonly<{ id: string; created: boolean }>> {
    const existing = await this.prisma.aiCompatibilityExecution.findUnique({
      where: { identity: input.identity },
      select: { id: true },
    });
    if (existing) return { ...existing, created: false };
    try {
      const created = await this.prisma.aiCompatibilityExecution.create({
        data: {
          identity: input.identity,
          kind: AiCompatibilityExecutionKind.prompt_evaluation,
          promptRevisionId,
          providerRevisionId: input.providerRevisionId,
          featureKey: input.featureKey,
          contentHash: input.contentHash,
          contractVersion: input.contractVersion,
          evaluatorVersion: input.evaluatorVersion,
        },
        select: { id: true },
      });
      return { ...created, created: true };
    } catch (error) {
      const raced = await this.prisma.aiCompatibilityExecution.findUnique({
        where: { identity: input.identity },
        select: { id: true },
      });
      if (raced) return { ...raced, created: false };
      throw error;
    }
  }

  transition(
    featureKey: string,
    revisionId: string,
    from: readonly AiPromptBundleLifecycle[],
    to: AiPromptBundleLifecycle,
    timestamps: Readonly<{
      activatedAt?: Date | null;
      supersededAt?: Date | null;
    }> = {},
  ): Promise<boolean> {
    return transition(
      this.prisma,
      featureKey,
      revisionId,
      from,
      to,
      timestamps,
    );
  }

  discardDisposable(featureKey: string, revisionId: string): Promise<boolean> {
    return discardDisposable(this.prisma, featureKey, revisionId);
  }

  activate(
    featureKey: string,
    revisionId: string,
    allowedLifecycle: readonly AiPromptBundleLifecycle[],
    now: Date,
    compatibility?: AiPromptActivationCompatibility,
  ): Promise<boolean> {
    return activate(
      this.prisma,
      featureKey,
      revisionId,
      allowedLifecycle,
      now,
      compatibility,
    );
  }
}
