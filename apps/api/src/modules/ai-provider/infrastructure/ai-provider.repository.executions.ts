import { AiCompatibilityExecutionKind, type Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
export type ProviderExecutionRequest = Readonly<{
  evaluatorVersion: string;
}>;

const revisionExecutionIdentity = (
  compositeIdentity: string,
  revisionId: string,
): string => `${compositeIdentity}:revision:${revisionId}`;

const retryableTerminalOutcomes = new Set(["inconclusive", "incompatible"]);

export const createOrReuseProviderExecution = async (
  prisma: PrismaService,
  revisionId: string,
  input: ProviderExecutionRequest,
): Promise<Readonly<{ id: string; created: boolean }>> => {
  const revision = await prisma.aiProviderConfiguration.findUnique({
    where: { id: revisionId },
    select: { compositeTestIdentity: true },
  });
  if (!revision) {
    throw new Error(
      "AI provider revision was not found for compatibility execution",
    );
  }
  const baseIdentity = revisionExecutionIdentity(
    revision.compositeTestIdentity,
    revisionId,
  );
  const executions = await prisma.aiCompatibilityExecution.findMany({
    where: {
      OR: [
        { identity: baseIdentity },
        { identity: { startsWith: `${baseIdentity}:retry:` } },
      ],
    },
    orderBy: { requestedAt: "desc" },
    select: { id: true, outcome: true },
  });
  const existing = executions[0];
  if (
    existing &&
    (existing.outcome === null ||
      !retryableTerminalOutcomes.has(existing.outcome))
  ) {
    return { id: existing.id, created: false };
  }
  const identity = existing
    ? `${baseIdentity}:retry:${executions.length}`
    : baseIdentity;
  try {
    const created = await prisma.aiCompatibilityExecution.create({
      data: {
        identity,
        kind: AiCompatibilityExecutionKind.provider_test,
        providerRevisionId: revisionId,
        evaluatorVersion: input.evaluatorVersion,
      },
      select: { id: true },
    });
    return { ...created, created: true };
  } catch (error) {
    const raced = await prisma.aiCompatibilityExecution.findUnique({
      where: { identity },
      select: { id: true },
    });
    if (raced) return { ...raced, created: false };
    throw error;
  }
};

export const startCompatibilityExecution = async (
  prisma: PrismaService,
  id: string,
): Promise<boolean> => {
  const result = await prisma.aiCompatibilityExecution.updateMany({
    where: { id, state: { in: ["queued", "running"] } },
    data: { state: "running", startedAt: new Date() },
  });
  return result.count === 1;
};

export const updateProviderExecutionIdentity = async (
  prisma: PrismaService,
  id: string,
  identity: string,
  revisionId: string,
): Promise<boolean> => {
  const existing = await prisma.aiCompatibilityExecution.findUnique({
    where: { id },
    select: { identity: true },
  });
  if (!existing) return false;
  const retrySuffix = /:retry:\d+$/u.exec(existing.identity)?.[0] ?? "";
  const result = await prisma.aiCompatibilityExecution.updateMany({
    where: { id, kind: AiCompatibilityExecutionKind.provider_test },
    data: {
      identity: `${revisionExecutionIdentity(identity, revisionId)}${retrySuffix}`,
    },
  });
  return result.count === 1;
};

export const completeCompatibilityExecution = async (
  prisma: PrismaService,
  id: string,
  outcome: "passed" | "incompatible" | "configuration_error" | "inconclusive",
  failureCode: string | null,
  checks: Prisma.InputJsonValue,
): Promise<void> => {
  await prisma.aiCompatibilityExecution.update({
    where: { id },
    data: {
      state: "completed",
      outcome,
      failureCode,
      checks,
      completedAt: new Date(),
    },
  });
};

export const getCompatibilityExecution = (
  prisma: PrismaService,
  id: string,
): Promise<Readonly<{
  providerRevisionId: string;
  promptRevisionId: string | null;
  featureKey: string | null;
  kind: "provider_test" | "prompt_evaluation";
}> | null> =>
  prisma.aiCompatibilityExecution.findUnique({
    where: { id },
    select: {
      providerRevisionId: true,
      promptRevisionId: true,
      featureKey: true,
      kind: true,
    },
  });
