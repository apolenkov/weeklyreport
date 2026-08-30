import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
  adminReminderRuleSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { isUniqueViolation } from "../../lib/prisma-unique-violation.js";
import {
  type ReminderQueuePayload,
  reminderQueuePayloadSchema,
} from "./reminders-queue-payload.js";

const ISO_DATE_LENGTH = 10;

// Domain `queued` persists as the Prisma `pending` enum value; every other
// status (including the in-flight `sending` claim) shares its name across the
// two vocabularies.
type PrismaExecStatus = NonNullable<
  Prisma.ReminderExecutionUncheckedCreateInput["status"]
>;

const execStatusToDb: Record<
  AdminReminderExecution["status"],
  PrismaExecStatus
> = {
  queued: "pending",
  sending: "sending",
  sent: "sent",
  failed: "failed",
};

const dbExecStatusToDomain: Record<
  PrismaExecStatus,
  AdminReminderExecution["status"]
> = {
  pending: "queued",
  sending: "sending",
  sent: "sent",
  failed: "failed",
};

export function toExecutionCreateData(
  execution: AdminReminderExecution,
  queuePayload: ReminderQueuePayload,
): Prisma.ReminderExecutionUncheckedCreateInput {
  const validatedPayload = reminderQueuePayloadSchema.parse(queuePayload);
  return {
    id: execution.id,
    ruleId: execution.ruleId,
    recipientEmail: execution.recipientEmail,
    dedupeKey: execution.dedupeKey,
    status: execStatusToDb[execution.status],
    sentAt: execution.sentAt,
    error: execution.errorMessage,
    queuePayload: validatedPayload,
  };
}

export function toQueuePayload(value: unknown): ReminderQueuePayload | null {
  return reminderQueuePayloadSchema.safeParse(value).data ?? null;
}

export function formatPeriodLabel(start: Date, end: Date): string {
  return `${start.toISOString().slice(0, ISO_DATE_LENGTH)} → ${end
    .toISOString()
    .slice(0, ISO_DATE_LENGTH)}`;
}

// Only a `ReminderExecution` insert reaches here, so matching the `dedupeKey`
// unique index is unambiguous; the shared guard carries the pg-adapter matching
// (serialized meta + message, never `meta.target` alone).
export function isDedupeKeyConflict(error: unknown): boolean {
  return isUniqueViolation(error, {
    index: "ReminderExecution_dedupeKey_key",
    columns: ["dedupeKey"],
  });
}

export function toRuleDomain(rule: {
  id: string;
  kind: string;
  fireAt: Date;
  timezone: string;
  status: string;
  version: number;
  reportId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminReminderRule {
  return adminReminderRuleSchema.parse({
    id: rule.id,
    reportId: rule.reportId,
    kind: rule.kind,
    fireAt: rule.fireAt,
    timezone: rule.timezone,
    status: rule.status,
    version: rule.version,
  });
}

export function toExecutionDomain(execution: {
  id: string;
  ruleId: string;
  recipientEmail: string;
  dedupeKey: string;
  status: PrismaExecStatus;
  sentAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  rule: { reportId: string | null };
}): AdminReminderExecution {
  return adminReminderExecutionSchema.parse({
    id: execution.id,
    ruleId: execution.ruleId,
    reportId: execution.rule.reportId,
    dedupeKey: execution.dedupeKey,
    status: dbExecStatusToDomain[execution.status],
    scheduledFor: execution.createdAt,
    sentAt: execution.sentAt,
    recipientEmail: execution.recipientEmail,
    errorMessage: execution.error,
  });
}
