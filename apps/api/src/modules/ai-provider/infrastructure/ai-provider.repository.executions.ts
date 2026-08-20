import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
export type ProviderExecutionRequest = Readonly<{
  testSuiteVersion: string;
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
): Promise<
  Readonly<{
    id: string;
    created: boolean;
    state: "queued" | "running" | "completed";
  }>
> => {
  const revision = await prisma.aiProviderConfiguration.findUnique({
    where: { id: revisionId },
    select: { compositeTestIdentity: true },
  });
  if (!revision) {
    throw new Error(
      "AI provider revision was not found for provider test execution",
    );
  }
  const baseIdentity = revisionExecutionIdentity(
    revision.compositeTestIdentity,
    revisionId,
  );
  const executions = await prisma.aiProviderTestExecution.findMany({
    where: {
      OR: [
        { identity: baseIdentity },
        { identity: { startsWith: `${baseIdentity}:retry:` } },
      ],
    },
    orderBy: { requestedAt: "desc" },
    select: { id: true, outcome: true, state: true },
  });
  const existing = executions[0];
  if (
    existing &&
    (existing.outcome === null ||
      !retryableTerminalOutcomes.has(existing.outcome))
  ) {
    return { id: existing.id, created: false, state: existing.state };
  }
  const identity = existing
    ? `${baseIdentity}:retry:${executions.length}`
    : baseIdentity;
  try {
    const created = await prisma.aiProviderTestExecution.create({
      data: {
        identity,
        providerRevisionId: revisionId,
        testSuiteVersion: input.testSuiteVersion,
      },
      select: { id: true },
    });
    return { ...created, created: true, state: "queued" };
  } catch (error) {
    const raced = await prisma.aiProviderTestExecution.findUnique({
      where: { identity },
      select: { id: true, state: true },
    });
    if (raced) return { ...raced, created: false };
    throw error;
  }
};

export const startProviderTestExecution = async (
  prisma: PrismaService,
  id: string,
): Promise<boolean> => {
  const result = await prisma.aiProviderTestExecution.updateMany({
    where: { id, state: "queued" },
    data: { state: "running", startedAt: new Date() },
  });
  return result.count === 1;
};

export const updateProviderTestExecutionIdentity = async (
  prisma: PrismaService,
  id: string,
  identity: string,
  revisionId: string,
): Promise<boolean> => {
  const existing = await prisma.aiProviderTestExecution.findUnique({
    where: { id },
    select: { identity: true },
  });
  if (!existing) return false;
  const retrySuffix = /:retry:\d+$/u.exec(existing.identity)?.[0] ?? "";
  const result = await prisma.aiProviderTestExecution.updateMany({
    where: { id },
    data: {
      identity: `${revisionExecutionIdentity(identity, revisionId)}${retrySuffix}`,
    },
  });
  return result.count === 1;
};

export const completeProviderTestExecution = async (
  prisma: PrismaService,
  id: string,
  outcome: "passed" | "incompatible" | "configuration_error" | "inconclusive",
  failureCode: string | null,
  checks: Prisma.InputJsonValue,
): Promise<void> => {
  await prisma.aiProviderTestExecution.update({
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

export const getProviderTestExecution = (
  prisma: PrismaService,
  id: string,
): Promise<Readonly<{ providerRevisionId: string }> | null> =>
  prisma.aiProviderTestExecution.findUnique({
    where: { id },
    select: {
      providerRevisionId: true,
    },
  });
