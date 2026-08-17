import {
  AiPromptBundleLifecycle,
  AiPromptEvaluationOutcome,
  Prisma,
} from "@prisma/client";

export const evaluationSelect = {
  id: true,
  featureKey: true,
  promptRevisionId: true,
  generationCompatibilityIdentity: true,
  contentHash: true,
  contractVersion: true,
  evaluatorVersion: true,
  checks: true,
  outcome: true,
  evaluatedAt: true,
} as const;

export const revisionSelect = {
  id: true,
  featureKey: true,
  revision: true,
  baseRevisionId: true,
  coreContractVersion: true,
  composerVersion: true,
  lockedCoreSnapshot: true,
  promptContents: true,
  effectiveContentHash: true,
  lifecycle: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  activatedAt: true,
  supersededAt: true,
  evaluations: {
    select: evaluationSelect,
    orderBy: { evaluatedAt: "desc" as const },
    take: 1,
  },
  compatibilityExecutions: {
    select: {
      id: true,
      state: true,
      outcome: true,
      failureCode: true,
      checks: true,
      requestedAt: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: { requestedAt: "desc" as const },
    take: 1,
  },
} as const;

export type StoredAiPromptEvaluation = Readonly<{
  id: string;
  featureKey: string;
  promptRevisionId: string;
  generationCompatibilityIdentity: string;
  contentHash: string;
  contractVersion: string;
  evaluatorVersion: string;
  checks: Prisma.JsonValue;
  outcome: AiPromptEvaluationOutcome;
  evaluatedAt: Date;
}>;

export type StoredAiPromptBundleRevision = Readonly<{
  id: string;
  featureKey: string;
  revision: number;
  baseRevisionId: string | null;
  coreContractVersion: string;
  composerVersion: string;
  lockedCoreSnapshot: Prisma.JsonValue;
  promptContents: Prisma.JsonValue;
  effectiveContentHash: string;
  lifecycle: AiPromptBundleLifecycle;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  supersededAt: Date | null;
  latestEvaluation: StoredAiPromptEvaluation | null;
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
  lockedCoreSnapshot: Prisma.InputJsonValue;
  promptContents: Prisma.InputJsonValue;
  effectiveContentHash: string;
  createdBy: string;
}>;

export type NewAiPromptEvaluation = Readonly<{
  featureKey: string;
  promptRevisionId: string;
  generationCompatibilityIdentity: string;
  contentHash: string;
  contractVersion: string;
  evaluatorVersion: string;
  checks: Prisma.InputJsonValue;
  outcome: AiPromptEvaluationOutcome;
  evaluatedAt: Date;
}>;

export type AiPromptEvaluationLookup = Readonly<{
  promptRevisionId: string;
  generationCompatibilityIdentity: string;
  contentHash: string;
  contractVersion: string;
  evaluatorVersion: string;
}>;

export type AiPromptActivationCompatibility = Readonly<{
  generationCompatibilityIdentity: string;
  contentHash: string;
  contractVersion: string;
  evaluatorVersion: string;
  evaluationId: string;
}>;

export type NewAiPromptBootstrap = Readonly<{
  featureKey: string;
  coreContractVersion: string;
  composerVersion: string;
  lockedCoreSnapshot: Prisma.InputJsonValue;
  promptContents: Prisma.InputJsonValue;
  effectiveContentHash: string;
  createdBy: string;
}>;

export type RevisionRecord = Prisma.AiPromptBundleRevisionGetPayload<{
  select: typeof revisionSelect;
}>;

export type ControlRecord = Prisma.AiFeaturePromptControlGetPayload<{
  include: { activeRevision: { select: typeof revisionSelect } };
}>;

export const toEvaluation = (
  value: RevisionRecord["evaluations"][number],
): StoredAiPromptEvaluation => value;

export const toRevision = (
  value: RevisionRecord,
): StoredAiPromptBundleRevision => ({
  id: value.id,
  featureKey: value.featureKey,
  revision: value.revision,
  baseRevisionId: value.baseRevisionId,
  coreContractVersion: value.coreContractVersion,
  composerVersion: value.composerVersion,
  lockedCoreSnapshot: value.lockedCoreSnapshot,
  promptContents: value.promptContents,
  effectiveContentHash: value.effectiveContentHash,
  lifecycle: value.lifecycle,
  createdBy: value.createdBy,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
  activatedAt: value.activatedAt,
  supersededAt: value.supersededAt,
  latestEvaluation: value.evaluations[0]
    ? toEvaluation(value.evaluations[0])
    : null,
  latestExecution: value.compatibilityExecutions[0] ?? null,
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
