import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
export type ProviderExecutionRequest = Readonly<{
  testSuiteVersion: string;
}>;

const revisionExecutionIdentity = (
  compositeIdentity: string,
  revisionId: string,
): string => `${compositeIdentity}:revision:${revisionId}`;

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
    select: { id: true, outcome: true, state: true, testSuiteVersion: true },
  });
  const existing = executions.find(
    (execution) => execution.testSuiteVersion === input.testSuiteVersion,
  );
  if (existing?.outcome === null) {
    return { id: existing.id, created: false, state: existing.state };
  }
  const identity =
    executions.length > 0
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
  executionAttempt = FIRST_EXECUTION_ATTEMPT,
): Promise<boolean> => {
  const startedAt = new Date();
  const queued = await prisma.aiProviderTestExecution.updateMany({
    where: { id, state: "queued" },
    data: { state: "running", startedAt, executionAttempt },
  });
  if (queued.count === 1) return true;

  // BullMQ increments attemptsStarted whenever it moves a job to active,
  // including a recovery from a stalled worker. A later processing attempt can
  // therefore atomically replace a crashed claimant, while a duplicate delivery
  // of the same attempt remains a no-op.
  const reclaimed = await prisma.aiProviderTestExecution.updateMany({
    where: {
      id,
      state: "running",
      executionAttempt: { lt: executionAttempt },
    },
    data: { startedAt, executionAttempt },
  });
  return reclaimed.count === 1;
};

export const completeProviderTestExecution = async (
  prisma: PrismaService,
  id: string,
  outcome: "passed" | "incompatible" | "configuration_error" | "inconclusive",
  failureCode: string | null,
  checks: Prisma.InputJsonValue,
  executionAttempt = FIRST_EXECUTION_ATTEMPT,
): Promise<boolean> => {
  const completed = await prisma.aiProviderTestExecution.updateMany({
    where: { id, state: "running", executionAttempt },
    data: {
      state: "completed",
      outcome,
      failureCode,
      checks,
      completedAt: new Date(),
    },
  });
  return completed.count === 1;
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

const FIRST_EXECUTION_ATTEMPT = 1;
