import type { AdminReminderExecution } from "@customreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { errorMessage as normalizeErrorMessage } from "../../lib/error-message.js";
import { ReminderExecutionIneligibleError } from "./reminders.errors.js";
import type {
  ClaimedReminderExecution,
  ReminderExecutionRecordResult,
} from "./reminders.types.js";
import type { ExecutionPageRequest } from "./reminders-execution-pagination.js";
import {
  type ReminderQueuePayload,
  reminderQueuePayloadSchema,
} from "./reminders-queue-payload.js";
import {
  toExecutionCreateData,
  toExecutionDomain,
  toQueuePayload,
} from "./reminders-row-mappers.js";

const executionRule = {
  select: { reportId: true, fireAt: true },
} as const;

function payloadDeadline(queuePayload: ReminderQueuePayload): Date {
  if (queuePayload.kind === "deadline") {
    return new Date(queuePayload.deadlineIso);
  }
  const deadlineIso = queuePayload.lateLeads[0]?.deadlineIso;
  if (
    deadlineIso === undefined ||
    queuePayload.lateLeads.some((lead) => lead.deadlineIso !== deadlineIso)
  ) {
    throw new ReminderExecutionIneligibleError();
  }
  return new Date(deadlineIso);
}

export async function queryExecutionByDedupeKey(
  prisma: PrismaService,
  dedupeKey: string,
): Promise<AdminReminderExecution | null> {
  const execution = await prisma.reminderExecution.findUnique({
    where: { dedupeKey },
    include: { rule: executionRule },
  });
  return execution ? toExecutionDomain(execution) : null;
}

export async function insertExecutionOnConflict(
  prisma: PrismaService,
  execution: AdminReminderExecution,
  queuePayload: ReminderQueuePayload,
  allowFailedRevival = false,
): Promise<ReminderExecutionRecordResult> {
  return prisma.$transaction(async (tx) => {
    const ruleOwner = await tx.reminderRule.findUnique({
      where: { id: execution.ruleId },
      select: { policyId: true },
    });
    if (!ruleOwner) throw new ReminderExecutionIneligibleError();
    const [policy] = await tx.$queryRaw<{ active: boolean }[]>`
      SELECT "active"
      FROM "ReminderPolicy"
      WHERE "id" = ${ruleOwner.policyId}
      FOR UPDATE
    `;
    if (!policy?.active) throw new ReminderExecutionIneligibleError();

    const executionDeadline = payloadDeadline(queuePayload);
    // Lock the rule and owning Report under the exact editable predicate. A
    // concurrent publish either commits first (zero rows, no insert) or waits
    // for this transaction; it cannot slip between this guard and the write.
    const eligible = await tx.$queryRaw<{ id: string }[]>`
      SELECT rule."id"
      FROM "ReminderRule" AS rule
      INNER JOIN "Report" AS report ON report."id" = rule."reportId"
      INNER JOIN "ReminderPolicy" AS policy ON policy."id" = rule."policyId"
      WHERE rule."id" = ${execution.ruleId}
        AND rule."policyId" = ${ruleOwner.policyId}
        AND rule."reportId" = ${execution.reportId}
        AND rule."fireAt" = ${execution.scheduledFor}
        AND rule."kind" = ${queuePayload.kind}::"ReminderRuleKind"
        AND rule."deadline" = ${executionDeadline}
        AND rule."fireAt"::date = ${queuePayload.cycleDate}::date
        AND rule."status" = 'active'::"ReminderRuleStatus"
        AND policy."active" = true
        AND policy."kind" = rule."kind"
        AND policy."timezone" = rule."timezone"
        AND policy."validFrom" <= rule."deadline"
        AND (policy."validUntil" IS NULL OR policy."validUntil" >= rule."deadline")
        AND rule."fireAt" = rule."deadline" + policy."offsetMinutes" * INTERVAL '1 minute'
        AND report."deadline" IS NOT NULL
        AND report."deadline" = rule."deadline"
        AND report."archived" = false
        AND report."periodState" = 'open'::"PeriodState"
        AND (
          (report."status" = 'draft'::"ReportStatus" AND report."periodStatus" = 'open'::"PeriodStatus")
          OR
          (report."status" = 'published'::"ReportStatus" AND report."periodStatus" = 'reopened'::"PeriodStatus")
        )
      FOR UPDATE OF rule, report
    `;
    if (eligible.length === 0) {
      throw new ReminderExecutionIneligibleError();
    }

    // ON CONFLICT DO NOTHING keeps the transaction usable so the loser can
    // return the canonical deduplicated row from the same locked snapshot.
    const inserted = await tx.reminderExecution.createMany({
      data: toExecutionCreateData(execution, queuePayload),
      skipDuplicates: true,
    });
    const persisted = await tx.reminderExecution.findUnique({
      where: { dedupeKey: execution.dedupeKey },
      include: { rule: executionRule },
    });
    if (!persisted) {
      throw new Error(
        "Reminder execution insert conflicted without a matching dedupe row.",
      );
    }
    const domainExecution = toExecutionDomain(persisted);
    if (inserted.count === 1) {
      return { execution: domainExecution, outcome: "created" };
    }
    if (allowFailedRevival && persisted.status === "failed") {
      const revived = await tx.reminderExecution.updateMany({
        where: { id: persisted.id, status: "failed" },
        data: {
          status: "pending",
          error: null,
          queuePayload: reminderQueuePayloadSchema.parse(queuePayload),
        },
      });
      if (revived.count === 1) {
        return {
          execution: {
            ...domainExecution,
            status: "queued",
            errorMessage: null,
          },
          outcome: "revived",
        };
      }
    }
    return { execution: domainExecution, outcome: "deduplicated" };
  });
}

export async function queryExecutionQueuePayload(
  prisma: PrismaService,
  executionId: string,
): Promise<ReminderQueuePayload | null> {
  const row = await prisma.reminderExecution.findUnique({
    where: { id: executionId },
    select: { queuePayload: true },
  });
  return row ? toQueuePayload(row.queuePayload) : null;
}

// CAS claim: only one of two racing workers matches status pending → sending.
export async function transitionExecutionToSending(
  prisma: PrismaService,
  executionId: string,
): Promise<ClaimedReminderExecution | null> {
  return prisma.$transaction(async (tx) => {
    const [claimed] = await tx.$queryRaw<
      { recipientEmail: string; queuePayload: unknown }[]
    >`
      UPDATE "ReminderExecution"
      SET "status" = 'sending'::"ReminderExecutionStatus",
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${executionId}
        AND "status" = 'pending'::"ReminderExecutionStatus"
      RETURNING "recipientEmail", "queuePayload"
    `;
    if (!claimed) return null;
    return {
      recipientEmail: claimed.recipientEmail,
      // Validation happens inside the transaction: malformed durable state
      // rolls the status update back instead of burning the sending claim.
      queuePayload: reminderQueuePayloadSchema.parse(claimed.queuePayload),
    };
  });
}

// CAS completion: only the worker that owns the sending claim can mark the
// execution sent. Creation is deliberately impossible through this path.
export async function markExecutionSent(
  prisma: PrismaService,
  executionId: string,
  sentAt: Date,
): Promise<AdminReminderExecution | null> {
  const result = await prisma.reminderExecution.updateMany({
    where: { id: executionId, status: "sending" },
    data: { status: "sent", sentAt, error: null },
  });
  if (result.count === 0) return null;
  return queryExecutionById(prisma, executionId);
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
  failureMessage: string,
): Promise<void> {
  await prisma.reminderExecution.updateMany({
    where: { id: executionId, status: { in: ["pending", "sending"] } },
    data: { status: "failed", error: normalizeErrorMessage(failureMessage) },
  });
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
    include: { rule: executionRule },
    orderBy: [{ createdAt: "asc" }],
    take: STUCK_QUEUED_REAPER_BATCH_SIZE,
  });
  return executions.map(toExecutionDomain);
}

export const UNCERTAIN_DELIVERY_ERROR =
  "Delivery outcome unknown after worker timeout; manual redispatch required.";

// SMTP and the DB cannot commit atomically. A crashed `sending` worker may
// have failed before SMTP or after delivery, so persist the ambiguity honestly.
export async function markStuckSendingUncertain(
  prisma: PrismaService,
  olderThan: Date,
): Promise<number> {
  const result = await prisma.reminderExecution.updateMany({
    where: { status: "sending", updatedAt: { lt: olderThan } },
    data: { status: "failed", error: UNCERTAIN_DELIVERY_ERROR },
  });
  return result.count;
}

export async function queryExecutionById(
  prisma: PrismaService,
  executionId: string,
): Promise<AdminReminderExecution | null> {
  const execution = await prisma.reminderExecution.findUnique({
    where: { id: executionId },
    include: { rule: executionRule },
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
  // Keyset page at the database level. The service applies its derived
  // recipient allowlist to the explicit recipientEmail column while walking
  // these pages instead of loading the whole history.
  const executions = await prisma.reminderExecution.findMany({
    where: { ruleId },
    include: { rule: executionRule },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: page.take,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
  });

  return executions.map(toExecutionDomain);
}
