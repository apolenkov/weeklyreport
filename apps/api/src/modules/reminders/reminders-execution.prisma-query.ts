import type { AdminReminderExecution } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { ExecutionPageRequest } from "./reminders-execution-pagination.js";
import {
  isDedupeKeyConflict,
  toExecutionCreateData,
  toExecutionDomain,
  toExecutionUpdateData,
} from "./reminders-row-mappers.js";

/**
 * `ReminderExecution` row CRUD, following the module's
 * `reminders-rule.prisma-query.ts` / `reminders-scope.prisma-query.ts`
 * query-sibling-file idiom.
 */

export async function queryExecutionByDedupeKey(
  prisma: PrismaService,
  dedupeKey: string,
): Promise<AdminReminderExecution | null> {
  const execution = await prisma.reminderExecution.findUnique({
    where: { dedupeKey },
    include: { rule: true },
  });
  return execution ? toExecutionDomain(execution) : null;
}

export async function upsertExecution(
  prisma: PrismaService,
  execution: AdminReminderExecution,
): Promise<AdminReminderExecution> {
  const saved = await prisma.reminderExecution.upsert({
    where: { dedupeKey: execution.dedupeKey },
    create: toExecutionCreateData(execution),
    update: toExecutionUpdateData(execution),
    include: { rule: true },
  });

  return toExecutionDomain(saved);
}

export async function insertExecutionOnConflict(
  prisma: PrismaService,
  execution: AdminReminderExecution,
): Promise<{ execution: AdminReminderExecution; inserted: boolean }> {
  try {
    const created = await prisma.reminderExecution.create({
      data: toExecutionCreateData(execution),
      include: { rule: true },
    });
    return { execution: toExecutionDomain(created), inserted: true };
  } catch (error: unknown) {
    // A concurrent tick won the dedupeKey insert: re-read its committed row
    // and report `inserted: false` so the caller enqueues nothing. The losing
    // INSERT blocks until the winner commits, so the re-read always sees it.
    // Any other failure re-throws.
    if (!isDedupeKeyConflict(error)) throw error;
    const existing = await queryExecutionByDedupeKey(
      prisma,
      execution.dedupeKey,
    );
    if (!existing) throw error;
    return { execution: existing, inserted: false };
  }
}

/**
 * Atomic `queued → sending` claim. The predicate lives in the write's WHERE,
 * so two racing workers cannot both move the same row: exactly one `updateMany`
 * matches `status: "pending"` and returns count 1; the loser returns 0.
 */
export async function transitionExecutionToSending(
  prisma: PrismaService,
  executionId: string,
): Promise<boolean> {
  const result = await prisma.reminderExecution.updateMany({
    where: { id: executionId, status: "pending" },
    data: { status: "sending" },
  });
  return result.count > 0;
}

/**
 * Reverses the claim above (`sending → pending`) so a retryable dispatch
 * failure can be re-claimed by the next BullMQ attempt. Guarded to
 * `sending` in the write, so it is a no-op against a row that is already
 * `sent`/`failed` under a concurrent caller.
 */
export async function releaseExecutionClaim(
  prisma: PrismaService,
  executionId: string,
): Promise<void> {
  await prisma.reminderExecution.updateMany({
    where: { id: executionId, status: "sending" },
    data: { status: "pending" },
  });
}

/**
 * Terminal `failed` write. Guarded to the non-terminal states so it never
 * clobbers a row that already reached `sent` (a late enqueue-error write
 * arriving after a concurrent successful send stays a no-op).
 */
export async function markExecutionFailed(
  prisma: PrismaService,
  executionId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.reminderExecution.updateMany({
    where: { id: executionId, status: { in: ["pending", "sending"] } },
    data: { status: "failed", error: errorMessage },
  });
}

/**
 * Atomic `failed → queued` revival for a manual re-dispatch. Guarded to
 * `failed` in the write itself, so exactly one of two concurrent revivals
 * wins and only the winner enqueues a fresh email job.
 */
export async function requeueFailedExecution(
  prisma: PrismaService,
  executionId: string,
): Promise<boolean> {
  const result = await prisma.reminderExecution.updateMany({
    where: { id: executionId, status: "failed" },
    data: { status: "pending", error: null },
  });
  return result.count > 0;
}

/**
 * Executions still `queued` (Prisma `pending`) whose row is older than
 * `olderThan` — the pod-died-before-enqueue case that leaves no job and no
 * `failed` marker. `sending` rows are intentionally excluded: re-enqueuing an
 * in-flight send would risk a duplicate.
 */
export async function listStuckQueuedExecutions(
  prisma: PrismaService,
  olderThan: Date,
): Promise<AdminReminderExecution[]> {
  const executions = await prisma.reminderExecution.findMany({
    where: { status: "pending", createdAt: { lt: olderThan } },
    include: { rule: true },
    orderBy: [{ createdAt: "asc" }],
    take: 100,
  });
  return executions.map(toExecutionDomain);
}

export async function queryExecutionById(
  prisma: PrismaService,
  executionId: string,
): Promise<AdminReminderExecution | null> {
  const execution = await prisma.reminderExecution.findUnique({
    where: { id: executionId },
    include: { rule: true },
  });

  if (!execution) {
    return null;
  }

  return toExecutionDomain(execution);
}

export async function queryExecutionsPage(
  prisma: PrismaService,
  ruleId: string,
  page: ExecutionPageRequest,
): Promise<AdminReminderExecution[]> {
  // Keyset page at the database level: recipient scoping happens in the
  // service (recipientEmail is derived from dedupeKey, not a column), so the
  // service walks these pages instead of loading the whole history.
  const executions = await prisma.reminderExecution.findMany({
    where: { ruleId },
    include: { rule: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: page.take,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
  });

  return executions.map(toExecutionDomain);
}
