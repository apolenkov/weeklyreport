import { AiProviderLifecycle, type Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";

export const activateAiProviderRevision = async (
  prisma: PrismaService,
  id: string,
  now: Date,
  options: Readonly<{
    allowBootstrap?: boolean;
    promptEvaluatorVersions?: Readonly<Record<string, string>>;
  }> = {},
): Promise<boolean> =>
  prisma.$transaction(async (transaction) => {
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
      },
    });
    if (!candidate) return false;
    if (
      candidate.lifecycle === AiProviderLifecycle.draft &&
      !options.allowBootstrap
    ) {
      return false;
    }
    if (!passingCompositeEvidence(candidate.testResult)) return false;
    if (
      !(await hasCurrentProviderExecution(
        transaction,
        candidate.id,
        candidate.compositeTestIdentity,
      )) &&
      !options.allowBootstrap
    ) {
      return false;
    }
    if (control.activeConfigurationId && control.activeConfigurationId !== id) {
      const superseded = await transaction.aiProviderConfiguration.updateMany({
        where: {
          id: control.activeConfigurationId,
          lifecycle: AiProviderLifecycle.active,
        },
        data: {
          lifecycle: AiProviderLifecycle.superseded,
          supersededAt: now,
        },
      });
      if (superseded.count !== 1) return false;
    }
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
        data: { lifecycle: AiProviderLifecycle.active, activatedAt: now },
      });
    if (activatedCandidate.count !== 1) return false;
    const pointer = await transaction.aiProviderControl.updateMany({
      where: {
        id: "singleton",
        activeConfigurationId: control.activeConfigurationId,
      },
      data: { activeConfigurationId: id, enabled: true },
    });
    return pointer.count === 1;
  });

const passingCompositeEvidence = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const result = value as Record<string, unknown>;
  const lanePassed = (lane: unknown): boolean => {
    if (!lane || typeof lane !== "object" || Array.isArray(lane)) return false;
    const value = lane as Record<string, unknown>;
    const capabilities = value.capabilities;
    const featureCompatibility = value.featureCompatibility;
    return (
      value.status === "passed" &&
      Array.isArray(capabilities) &&
      capabilities.length > 0 &&
      capabilities.every(
        (capability) =>
          Boolean(capability) &&
          typeof capability === "object" &&
          (capability as Record<string, unknown>).status === "passed",
      ) &&
      (featureCompatibility === undefined ||
        (Array.isArray(featureCompatibility) &&
          featureCompatibility.every(
            (feature) =>
              Boolean(feature) &&
              typeof feature === "object" &&
              (feature as Record<string, unknown>).outcome === "passed",
          )))
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
  const execution = await transaction.aiCompatibilityExecution.findFirst({
    where: {
      providerRevisionId: revisionId,
      kind: "provider_test",
      state: "completed",
      outcome: "passed",
      OR: [
        { identity: compositeTestIdentity },
        { identity: { startsWith: `${compositeTestIdentity}:retry:` } },
        { identity: revisionIdentity },
        { identity: { startsWith: `${revisionIdentity}:retry:` } },
      ],
    },
    select: { id: true },
  });
  return execution !== null;
};
