import { AiPromptBundleLifecycle, Prisma } from "@prisma/client";

export const revisionSelect = {
  id: true,
  featureKey: true,
  revision: true,
  baseRevisionId: true,
  coreContractVersion: true,
  composerVersion: true,
  servingContractVersion: true,
  lockedCoreSnapshot: true,
  promptContents: true,
  effectiveContentHash: true,
  lifecycle: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  activatedAt: true,
  supersededAt: true,
} as const;

export type StoredAiPromptBundleRevision = Readonly<{
  id: string;
  featureKey: string;
  revision: number;
  baseRevisionId: string | null;
  coreContractVersion: string;
  composerVersion: string;
  servingContractVersion: string | null;
  lockedCoreSnapshot: Prisma.JsonValue;
  promptContents: Prisma.JsonValue;
  effectiveContentHash: string;
  lifecycle: AiPromptBundleLifecycle;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  supersededAt: Date | null;
}>;

export type StoredAiFeaturePromptControl = Readonly<{
  id: string;
  featureKey: string;
  activeRevisionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  activeRevision: StoredAiPromptBundleRevision | null;
  latestRevision: StoredAiPromptBundleRevision | null;
  history: readonly StoredAiPromptBundleRevision[];
}>;

export type NewAiPromptBundleRevision = Readonly<{
  featureKey: string;
  baseRevisionId: string;
  coreContractVersion: string;
  composerVersion: string;
  servingContractVersion: string;
  lockedCoreSnapshot: Prisma.InputJsonValue;
  promptContents: Prisma.InputJsonValue;
  effectiveContentHash: string;
  createdBy: string;
}>;

export type AiPromptActivationContract = Readonly<{
  servingContractVersion: string;
}>;

export type NewAiPromptBootstrap = Readonly<{
  featureKey: string;
  coreContractVersion: string;
  composerVersion: string;
  servingContractVersion: string;
  lockedCoreSnapshot: Prisma.InputJsonValue;
  promptContents: Prisma.InputJsonValue;
  effectiveContentHash: string;
  createdBy: string;
}>;

export type NewAiPromptHandoff = Readonly<{
  featureKey: string;
  servingContractVersion: string;
  coreContractVersion: string;
  composerVersion: string;
  lockedCoreSnapshot: Prisma.InputJsonValue;
  promptContents: Prisma.InputJsonValue;
  effectiveContentHash: string;
  createdBy: string;
}>;

export type AiPromptHandoffResult = Readonly<{
  revision: StoredAiPromptBundleRevision;
  created: boolean;
}>;

export type RevisionRecord = Prisma.AiPromptBundleRevisionGetPayload<{
  select: typeof revisionSelect;
}>;

export type ControlRecord = Prisma.AiFeaturePromptControlGetPayload<{
  include: { activeRevision: { select: typeof revisionSelect } };
}>;

export const toRevision = (
  value: RevisionRecord,
): StoredAiPromptBundleRevision => ({
  id: value.id,
  featureKey: value.featureKey,
  revision: value.revision,
  baseRevisionId: value.baseRevisionId,
  coreContractVersion: value.coreContractVersion,
  composerVersion: value.composerVersion,
  servingContractVersion: value.servingContractVersion,
  lockedCoreSnapshot: value.lockedCoreSnapshot,
  promptContents: value.promptContents,
  effectiveContentHash: value.effectiveContentHash,
  lifecycle: value.lifecycle,
  createdBy: value.createdBy,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
  activatedAt: value.activatedAt,
  supersededAt: value.supersededAt,
});

export const toControl = (
  value: ControlRecord,
): StoredAiFeaturePromptControl => ({
  id: value.id,
  featureKey: value.featureKey,
  activeRevisionId: value.activeRevisionId,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
  activeRevision: value.activeRevision
    ? toRevision(value.activeRevision)
    : null,
  latestRevision: null,
  history: [],
});

export const revisionWhere = (featureKey: string, revisionId: string) => ({
  id: revisionId,
  featureKey,
});
