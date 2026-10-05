import { AiProviderLifecycle, type Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { AI_PROVIDER_TEST_SUITE_VERSION } from "./ai-provider-test.queue.js";

export type AiProviderActivationReadiness =
  | Readonly<{
      mode: "prepared";
      sourceFingerprint: string;
      sourceGeneration: bigint;
    }>
  | Readonly<{
      mode: "reuse_active_scope";
      activeRevisionId: string;
      sourceFingerprint: string;
      sourceGeneration: bigint;
    }>;

type PreparationEvidence = Readonly<{
  preparationCompleted: number;
  preparationTotal: number;
  preparationFailed: number;
  preparationStartedAt: Date | null;
  preparationFinishedAt: Date | null;
  preparationElapsedMs: number;
  preparationSourceFingerprint: string;
  preparationSourceGeneration: bigint;
}>;

const preparationEvidenceSelect = {
  preparationCompleted: true,
  preparationTotal: true,
  preparationFailed: true,
  preparationStartedAt: true,
  preparationFinishedAt: true,
  preparationElapsedMs: true,
  preparationSourceFingerprint: true,
  preparationSourceGeneration: true,
} as const;

export const activateAiProviderRevision = async (
  prisma: PrismaService,
  id: string,
  now: Date,
  readiness: AiProviderActivationReadiness,
): Promise<boolean> => {
  try {
    return await prisma.$transaction(async (transaction) => {
      const control = await transaction.aiProviderControl.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" },
        select: { activeConfigurationId: true },
      });
      const candidate = await transaction.aiProviderConfiguration.findUnique({
        where: { id },
        select: {
          id: true,
          lifecycle: true,
          testResult: true,
          compositeTestIdentity: true,
          embeddingScopeIdentity: true,
          ...preparationEvidenceSelect,
        },
      });
      if (!candidate) return false;
      if (candidate.lifecycle === AiProviderLifecycle.draft) return false;
      if (readiness.mode === "prepared") {
        const currentSource = await transaction.$queryRaw<
          readonly { generation: bigint }[]
        >`SELECT "generation" FROM "SemanticSourceState" WHERE "id" = 'singleton' FOR UPDATE`;
        if (!matchesCurrentSourceGeneration(currentSource, readiness))
          return false;
      }
      const preparationEvidence = await resolvePreparationEvidence(
        transaction,
        control.activeConfigurationId,
        candidate,
        readiness,
      );
      if (!preparationEvidence) return false;
      if (!passingCompositeEvidence(candidate.testResult)) return false;
      const hasExecution = await hasCurrentProviderExecution(
        transaction,
        candidate.id,
        candidate.compositeTestIdentity,
      );
      if (!hasExecution) return false;
      await supersedePrevious(
        transaction,
        control.activeConfigurationId,
        id,
        now,
      );
      await promoteCandidate(transaction, {
        id,
        now,
        previousActiveId: control.activeConfigurationId,
        preparationEvidence,
      });
      return true;
    });
  } catch (error) {
    if (error instanceof ActivationRaceError) return false;
    throw error;
  }
};

class ActivationRaceError extends Error {}

const promoteCandidate = async (
  transaction: Prisma.TransactionClient,
  {
    id,
    now,
    previousActiveId,
    preparationEvidence,
  }: Readonly<{
    id: string;
    now: Date;
    previousActiveId: string | null;
    preparationEvidence: PreparationEvidence;
  }>,
): Promise<void> => {
  const activatedCandidate =
    await transaction.aiProviderConfiguration.updateMany({
      where: {
        id,
        lifecycle: {
          in: [
            AiProviderLifecycle.validated,
            AiProviderLifecycle.preparing,
            AiProviderLifecycle.active,
            AiProviderLifecycle.superseded,
          ],
        },
      },
      data: {
        ...preparationEvidence,
        lifecycle: AiProviderLifecycle.active,
        activatedAt: now,
      },
    });
  if (activatedCandidate.count !== 1) throw new ActivationRaceError();
  const pointer = await transaction.aiProviderControl.updateMany({
    where: {
      id: "singleton",
      activeConfigurationId: previousActiveId,
    },
    data: { activeConfigurationId: id, enabled: true },
  });
  if (pointer.count !== 1) throw new ActivationRaceError();
};

const resolvePreparationEvidence = async (
  transaction: Prisma.TransactionClient,
  activeConfigurationId: string | null,
  candidate: Readonly<{
    embeddingScopeIdentity: string;
  }> &
    Readonly<Record<keyof PreparationEvidence, unknown>>,
  readiness: AiProviderActivationReadiness,
): Promise<PreparationEvidence | null> => {
  if (readiness.mode === "prepared") {
    return matchingPreparationEvidence(candidate, readiness);
  }
  if (activeConfigurationId !== readiness.activeRevisionId) return null;
  const active = await transaction.aiProviderConfiguration.findUnique({
    where: { id: readiness.activeRevisionId },
    select: {
      lifecycle: true,
      embeddingScopeIdentity: true,
      ...preparationEvidenceSelect,
    },
  });
  if (
    active?.lifecycle !== AiProviderLifecycle.active ||
    active.embeddingScopeIdentity !== candidate.embeddingScopeIdentity
  ) {
    return null;
  }
  return matchingPreparationEvidence(active, readiness);
};

const supersedePrevious = async (
  transaction: Prisma.TransactionClient,
  previousId: string | null,
  candidateId: string,
  now: Date,
): Promise<void> => {
  if (!previousId || previousId === candidateId) return;
  const superseded = await transaction.aiProviderConfiguration.updateMany({
    where: { id: previousId, lifecycle: AiProviderLifecycle.active },
    data: { lifecycle: AiProviderLifecycle.superseded, supersededAt: now },
  });
  if (superseded.count !== 1) throw new ActivationRaceError();
};

const matchesCurrentSourceGeneration = (
  current: readonly { generation: bigint }[],
  readiness: AiProviderActivationReadiness,
): boolean =>
  current.length === 1 && current[0]?.generation === readiness.sourceGeneration;

const matchingPreparationEvidence = (
  value: Readonly<Record<keyof PreparationEvidence, unknown>>,
  readiness: AiProviderActivationReadiness,
): PreparationEvidence | null => {
  const evidence = value as Partial<PreparationEvidence>;
  if (
    evidence.preparationSourceFingerprint !== readiness.sourceFingerprint ||
    evidence.preparationSourceFingerprint.length === 0 ||
    evidence.preparationSourceGeneration !== readiness.sourceGeneration ||
    typeof evidence.preparationCompleted !== "number" ||
    evidence.preparationCompleted < 0 ||
    typeof evidence.preparationTotal !== "number" ||
    evidence.preparationTotal < 0 ||
    evidence.preparationCompleted !== evidence.preparationTotal ||
    evidence.preparationFailed !== 0 ||
    (evidence.preparationStartedAt !== null &&
      !(evidence.preparationStartedAt instanceof Date)) ||
    !(evidence.preparationFinishedAt instanceof Date) ||
    typeof evidence.preparationElapsedMs !== "number" ||
    evidence.preparationElapsedMs < 0
  ) {
    return null;
  }
  return {
    preparationCompleted: evidence.preparationCompleted,
    preparationTotal: evidence.preparationTotal,
    preparationFailed: evidence.preparationFailed,
    preparationStartedAt: evidence.preparationStartedAt,
    preparationFinishedAt: evidence.preparationFinishedAt,
    preparationElapsedMs: evidence.preparationElapsedMs,
    preparationSourceFingerprint: evidence.preparationSourceFingerprint,
    preparationSourceGeneration: evidence.preparationSourceGeneration,
  };
};

const passingCompositeEvidence = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const result = value as Record<string, unknown>;
  const lanePassed = (lane: unknown): boolean => {
    if (!lane || typeof lane !== "object" || Array.isArray(lane)) return false;
    const value = lane as Record<string, unknown>;
    const capabilities = value.capabilities;
    return (
      value.status === "passed" &&
      Array.isArray(capabilities) &&
      capabilities.length > 0 &&
      capabilities.every(
        (capability) =>
          Boolean(capability) &&
          typeof capability === "object" &&
          (capability as Record<string, unknown>).status === "passed",
      )
    );
  };
  return (
    result.status === "passed" &&
    lanePassed(result.generation) &&
    lanePassed(result.embeddings)
  );
};

const hasCurrentProviderExecution = async (
  transaction: Prisma.TransactionClient,
  revisionId: string,
  compositeTestIdentity: string,
): Promise<boolean> => {
  const revisionIdentity = `${compositeTestIdentity}:revision:${revisionId}`;
  const execution = await transaction.aiProviderTestExecution.findFirst({
    select: { id: true },
    where: {
      providerRevisionId: revisionId,
      state: "completed",
      outcome: "passed",
      testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
      OR: [
        { identity: compositeTestIdentity },
        { identity: { startsWith: `${compositeTestIdentity}:retry:` } },
        { identity: revisionIdentity },
        { identity: { startsWith: `${revisionIdentity}:retry:` } },
      ],
    },
  });
  return execution !== null;
};
