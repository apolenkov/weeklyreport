import { AiPromptBundleLifecycle } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  type AiPromptActivationCompatibility,
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
  compatibility?: AiPromptActivationCompatibility,
): Promise<boolean> =>
  prisma.$transaction(async (transaction) => {
    const control = await transaction.aiFeaturePromptControl.findUnique({
      where: { featureKey },
      select: { activeRevisionId: true },
    });
    if (!control) return false;
    if (compatibility) {
      const providerControl = await transaction.aiProviderControl.findUnique({
        where: { id: "singleton" },
        select: { enabled: true, activeConfigurationId: true },
      });
      if (
        providerControl?.enabled !== true ||
        providerControl.activeConfigurationId === null
      ) {
        return false;
      }
      const provider = await transaction.aiProviderConfiguration.findUnique({
        where: { id: providerControl.activeConfigurationId },
        select: { generationCompatibilityIdentity: true },
      });
      if (
        provider?.generationCompatibilityIdentity !==
        compatibility.generationCompatibilityIdentity
      ) {
        return false;
      }
      const evaluation = await transaction.aiPromptEvaluation.findUnique({
        where: {
          promptRevisionId_generationCompatibilityIdentity_contentHash_contractVersion_evaluatorVersion:
            {
              promptRevisionId: revisionId,
              generationCompatibilityIdentity:
                compatibility.generationCompatibilityIdentity,
              contentHash: compatibility.contentHash,
              contractVersion: compatibility.contractVersion,
              evaluatorVersion: compatibility.evaluatorVersion,
            },
        },
        select: { id: true, outcome: true },
      });
      if (
        evaluation?.id !== compatibility.evaluationId ||
        evaluation.outcome !== "passed"
      ) {
        return false;
      }
    }
    const candidate = await transaction.aiPromptBundleRevision.updateMany({
      where: {
        ...revisionWhere(featureKey, revisionId),
        lifecycle: { in: [...allowedLifecycle] },
      },
      data: { lifecycle: AiPromptBundleLifecycle.active, activatedAt: now },
    });
    if (candidate.count !== 1) return false;
    if (control.activeRevisionId && control.activeRevisionId !== revisionId) {
      await transaction.aiPromptBundleRevision.updateMany({
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
    }
    const pointer = await transaction.aiFeaturePromptControl.updateMany({
      where: { featureKey, activeRevisionId: control.activeRevisionId },
      data: { activeRevisionId: revisionId },
    });
    return pointer.count === 1;
  });
