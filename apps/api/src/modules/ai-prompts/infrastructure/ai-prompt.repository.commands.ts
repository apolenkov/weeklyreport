import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  type NewAiPromptBundleRevision,
  revisionSelect,
  type StoredAiPromptBundleRevision,
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
        servingContractVersion: input.servingContractVersion,
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
