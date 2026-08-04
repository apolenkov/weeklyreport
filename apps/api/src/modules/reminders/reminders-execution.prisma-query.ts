import type { AdminReminderExecution } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { ExecutionPageRequest } from "./reminders-execution-pagination.js";
import {
  isDedupeKeyConflict,
  toExecutionCreateData,
  toExecutionDomain,
  toExecutionUpdateData,
} from "./reminders-row-mappers.js";

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
    // Concurrent tick won the dedupeKey insert — re-read, report inserted:false.
    if (!isDedupeKeyConflict(error)) throw error;
    const existing = await queryExecutionByDedupeKey(
      prisma,
      execution.dedupeKey,
    );
    if (!existing) throw error;
    return { execution: existing, inserted: false };
  }
}

// CAS claim: only one of two racing workers matches status pending → sending.
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

// sending → pending for retryable failures; no-op if already sent/failed.
export async function releaseExecutionClaim(
  prisma: PrismaService,
  executionId: string,
): Promise<void> {
  await prisma.reminderExecution.updateMany({
    where: { id: executionId, status: "sending" },
    data: { status: "pending" },
  });
}

// Terminal failed; guarded so it never clobbers an already-sent row.
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

// failed → queued CAS; exactly one concurrent revival wins.
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

// Pod-died-before-enqueue: queued older than threshold. Exclude sending (dup risk).
// Cap per reaper tick so a flood of stuck rows cannot monopolize one sweep.
const STUCK_QUEUED_REAPER_BATCH_SIZE = 100;

export async function listStuckQueuedExecutions(
  prisma: PrismaService,
  olderThan: Date,
): Promise<AdminReminderExecution[]> {
  const executions = await prisma.reminderExecution.findMany({
    where: { status: "pending", createdAt: { lt: olderThan } },
    include: { rule: true },
    orderBy: [{ createdAt: "asc" }],
    take: STUCK_QUEUED_REAPER_BATCH_SIZE,
  });
  return executions.map(toExecutionDomain);
}

// A `sending` row is presumed delivered after a worker crash; CAS-resolve only
// rows still `sending` past the cutoff, never re-queue or fail a sent email.
export async function markStuckSendingSent(
  prisma: PrismaService,
  olderThan: Date,
): Promise<number> {
  const result = await prisma.reminderExecution.updateMany({
    where: { status: "sending", updatedAt: { lt: olderThan } },
    data: { status: "sent" },
  });
  return result.count;
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
