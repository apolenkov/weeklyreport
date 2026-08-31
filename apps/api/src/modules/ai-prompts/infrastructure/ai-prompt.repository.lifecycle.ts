import { AiPromptBundleLifecycle } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  type AiPromptActivationContract,
  revisionWhere,
} from "./ai-prompt.repository.types.js";

export const transition = async (
  prisma: PrismaService,
  featureKey: string,
  revisionId: string,
  from: readonly AiPromptBundleLifecycle[],
  to: AiPromptBundleLifecycle,
  timestamps: Readonly<{
    activatedAt?: Date | null;
    supersededAt?: Date | null;
  }> = {},
): Promise<boolean> => {
  const result = await prisma.aiPromptBundleRevision.updateMany({
    where: {
      ...revisionWhere(featureKey, revisionId),
      lifecycle: { in: [...from] },
    },
    data: { lifecycle: to, ...timestamps },
  });
  return result.count === 1;
};

export const discardDisposable = async (
  prisma: PrismaService,
  featureKey: string,
  revisionId: string,
): Promise<boolean> => {
  const result = await prisma.aiPromptBundleRevision.deleteMany({
    where: {
      ...revisionWhere(featureKey, revisionId),
      lifecycle: {
        in: [AiPromptBundleLifecycle.draft, AiPromptBundleLifecycle.failed],
      },
    },
  });
  return result.count === 1;
};

export const activate = async (
  prisma: PrismaService,
  featureKey: string,
  revisionId: string,
  allowedLifecycle: readonly AiPromptBundleLifecycle[],
  now: Date,
  contract: AiPromptActivationContract,
): Promise<boolean> => {
  try {
    return await prisma.$transaction(async (transaction) => {
      const control = await transaction.aiFeaturePromptControl.findUnique({
        where: { featureKey },
        select: { activeRevisionId: true },
      });
      if (!control) return false;
      const candidate = await transaction.aiPromptBundleRevision.updateMany({
        where: {
          ...revisionWhere(featureKey, revisionId),
          lifecycle: { in: [...allowedLifecycle] },
          servingContractVersion: contract.servingContractVersion,
        },
        data: { lifecycle: AiPromptBundleLifecycle.active, activatedAt: now },
      });
      if (candidate.count !== 1) throw new ActivationRaceError();
      if (control.activeRevisionId && control.activeRevisionId !== revisionId) {
        const superseded = await transaction.aiPromptBundleRevision.updateMany({
          where: {
            id: control.activeRevisionId,
            featureKey,
            lifecycle: AiPromptBundleLifecycle.active,
          },
          data: {
            lifecycle: AiPromptBundleLifecycle.superseded,
            supersededAt: now,
          },
        });
        if (superseded.count !== 1) throw new ActivationRaceError();
      }
      const pointer = await transaction.aiFeaturePromptControl.updateMany({
        where: { featureKey, activeRevisionId: control.activeRevisionId },
        data: { activeRevisionId: revisionId },
      });
      if (pointer.count !== 1) throw new ActivationRaceError();
      return true;
    });
  } catch (error) {
    if (error instanceof ActivationRaceError) return false;
    throw error;
  }
};

class ActivationRaceError extends Error {}
