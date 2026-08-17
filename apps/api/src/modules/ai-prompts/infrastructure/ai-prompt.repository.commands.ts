import { randomUUID } from "node:crypto";

import {
  AiPromptBundleLifecycle,
  AiPromptEvaluationOutcome,
  Prisma,
} from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  evaluationSelect,
  type NewAiPromptBootstrap,
  type NewAiPromptBundleRevision,
  type NewAiPromptEvaluation,
  revisionSelect,
  type StoredAiPromptBundleRevision,
  type StoredAiPromptEvaluation,
  toEvaluation,
  toRevision,
} from "./ai-prompt.repository.types.js";

export const createDraft = async (
  prisma: PrismaService,
  input: NewAiPromptBundleRevision,
): Promise<StoredAiPromptBundleRevision> => {
  const created = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(
      // PostgreSQL advisory locks serialize feature-local revision allocation
      // without holding a table-wide lock during independent feature writes.
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.featureKey}, 0))`,
    );
    await transaction.aiFeaturePromptControl.upsert({
      where: { featureKey: input.featureKey },
      update: {},
      create: { id: randomUUID(), featureKey: input.featureKey },
    });
    const latest = await transaction.aiPromptBundleRevision.aggregate({
      where: { featureKey: input.featureKey },
      _max: { revision: true },
    });
    return transaction.aiPromptBundleRevision.create({
      data: {
        id: randomUUID(),
        featureKey: input.featureKey,
        revision: (latest._max.revision ?? 0) + 1,
        baseRevisionId: input.baseRevisionId,
        coreContractVersion: input.coreContractVersion,
        composerVersion: input.composerVersion,
        lockedCoreSnapshot: input.lockedCoreSnapshot,
        promptContents: input.promptContents,
        effectiveContentHash: input.effectiveContentHash,
        createdBy: input.createdBy,
      },
      select: revisionSelect,
    });
  });
  return toRevision(created);
};

export const bootstrap = async (
  prisma: PrismaService,
  input: NewAiPromptBootstrap,
): Promise<StoredAiPromptBundleRevision | null> => {
  const created = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.featureKey}, 0))`,
    );
    const existing = await transaction.aiPromptBundleRevision.findFirst({
      where: { featureKey: input.featureKey },
      select: revisionSelect,
      orderBy: { revision: "asc" },
    });
    if (existing) return null;
    const control = await transaction.aiFeaturePromptControl.upsert({
      where: { featureKey: input.featureKey },
      update: {},
      create: { id: randomUUID(), featureKey: input.featureKey },
    });
    const revision = await transaction.aiPromptBundleRevision.create({
      data: {
        id: randomUUID(),
        featureKey: input.featureKey,
        revision: 1,
        coreContractVersion: input.coreContractVersion,
        composerVersion: input.composerVersion,
        lockedCoreSnapshot: input.lockedCoreSnapshot,
        promptContents: input.promptContents,
        effectiveContentHash: input.effectiveContentHash,
        lifecycle: AiPromptBundleLifecycle.active,
        createdBy: input.createdBy,
        activatedAt: new Date(),
      },
      select: revisionSelect,
    });
    await transaction.aiFeaturePromptControl.update({
      where: { id: control.id },
      data: { activeRevisionId: revision.id },
    });
    return revision;
  });
  return created ? toRevision(created) : null;
};

export const recordEvaluation = async (
  prisma: PrismaService,
  input: NewAiPromptEvaluation,
): Promise<StoredAiPromptEvaluation> => {
  const evaluation = await prisma.aiPromptEvaluation.upsert({
    where: {
      promptRevisionId_generationCompatibilityIdentity_contentHash_contractVersion_evaluatorVersion:
        {
          promptRevisionId: input.promptRevisionId,
          generationCompatibilityIdentity:
            input.generationCompatibilityIdentity,
          contentHash: input.contentHash,
          contractVersion: input.contractVersion,
          evaluatorVersion: input.evaluatorVersion,
        },
    },
    // Passing evidence is absorbing for one exact compatibility tuple. A later
    // nondeterministic probe may promote a failure, but cannot erase a pass.
    update:
      input.outcome === AiPromptEvaluationOutcome.passed
        ? {
            checks: input.checks,
            outcome: input.outcome,
            evaluatedAt: input.evaluatedAt,
          }
        : {},
    create: { id: randomUUID(), ...input },
    select: evaluationSelect,
  });
  return toEvaluation(evaluation);
};
