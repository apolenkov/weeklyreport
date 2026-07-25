import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
  adminReminderRuleSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { isUniqueViolation } from "../../lib/prisma-unique-violation.js";

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
): Prisma.ReminderExecutionUncheckedCreateInput {
  return {
    id: execution.id,
    ruleId: execution.ruleId,
    dedupeKey: execution.dedupeKey,
    status: execStatusToDb[execution.status],
    sentAt: execution.sentAt,
    error: execution.errorMessage,
  };
}

export function toExecutionUpdateData(execution: AdminReminderExecution): {
  status: PrismaExecStatus;
  sentAt: Date | null;
  error: string | null;
} {
  return {
    status: execStatusToDb[execution.status],
    sentAt: execution.sentAt,
    error: execution.errorMessage,
  };
}

export function formatPeriodLabel(start: Date, end: Date): string {
  // Compact UTC-formatted label, e.g. "2026-04-13 → 2026-04-19"
  return `${start.toISOString().slice(0, ISO_DATE_LENGTH)} → ${end
    .toISOString()
    .slice(0, ISO_DATE_LENGTH)}`;
}

/**
 * True when `error` is the Prisma P2002 raised by the `dedupeKey` unique index
 * (`ReminderExecution_dedupeKey_key`). The caller only inserts a
 * `ReminderExecution`, so the `dedupeKey` substring uniquely identifies this
 * conflict; any other violation returns false (and re-throws). The shared guard
 * carries the pg-adapter matching (serialized meta + message, never
 * `meta.target` alone).
 */
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

/**
 * Extracts recipientEmail from dedupeKey. Two key shapes are in flight:
 *
 *   Legacy:     `${ruleId}:<ISO with Z>:${email}`
 *     example: `<uuid>:2026-04-12T10:00:00.000Z:user@example.com`
 *
 *   Current:    `${ruleId}:${kind}:YYYY-MM-DD:${email}`
 *     example: `<uuid>:deadline:2026-04-12:user@example.com`
 *     example: `<uuid>:escalation:2026-04-12:head@example.com`
 *
 * Strategy: split on ':' and take the LAST segment that matches an email
 * shape. Both shapes terminate with the email, so this is robust to either
 * layout. Returns '' for unparseable inputs.
 */
// eslint-disable-next-line sonarjs/super-linear-regex -- negated character classes are linear; no catastrophic backtracking, input bounded to ~254 chars
const EMAIL_RE = /^[^@\s:]+@[^@\s:]+\.[^@\s:]+$/;
export function extractRecipientEmail(dedupeKey: string): string {
  const last = dedupeKey.split(":").pop();
  if (last && EMAIL_RE.test(last)) return last;
  return "";
}

export function toExecutionDomain(execution: {
  id: string;
  ruleId: string;
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
    recipientEmail: extractRecipientEmail(execution.dedupeKey),
    errorMessage: execution.error,
  });
}
