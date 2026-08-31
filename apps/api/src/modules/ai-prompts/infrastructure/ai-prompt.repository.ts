import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type { AiPromptBundleLifecycle } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { createDraft } from "./ai-prompt.repository.commands.js";
import {
  activate,
  discardDisposable,
  transition,
} from "./ai-prompt.repository.lifecycle.js";
import {
  type AiPromptActivationContract,
  type NewAiPromptBundleRevision,
  revisionSelect,
  revisionWhere,
  type StoredAiFeaturePromptControl,
  type StoredAiPromptBundleRevision,
  toControl,
  toRevision,
} from "./ai-prompt.repository.types.js";

export type {
  AiPromptActivationContract,
  NewAiPromptBundleRevision,
  StoredAiFeaturePromptControl,
  StoredAiPromptBundleRevision,
} from "./ai-prompt.repository.types.js";

const PROMPT_HISTORY_LIMIT = 100;

@Injectable()
export class AiPromptRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
    contract: AiPromptActivationContract,
  ): Promise<boolean> {
    return activate(
      this.prisma,
      featureKey,
      revisionId,
      allowedLifecycle,
      now,
      contract,
    );
  }
}
