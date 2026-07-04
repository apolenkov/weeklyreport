import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
  adminReminderRuleSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

/**
 * Pure Prisma-row <-> domain-model mappers for `RemindersPrismaRepository`,
 * split out (R3a-4 max-lines drain): execution/rule row translation, the
 * dedupeKey P2002 conflict detector, and the recipient-email extractor.
 */

/** Length of an ISO calendar date (`YYYY-MM-DD`) after `toISOString().slice(0, n)`. */
const ISO_DATE_LENGTH = 10;

const execStatusToDb: Record<string, string> = {
  queued: "pending",
  sent: "sent",
  failed: "failed",
};

const dbExecStatusToDomain: Record<string, AdminReminderExecution["status"]> = {
  pending: "queued",
  sent: "sent",
  failed: "failed",
};

/** Map a domain execution to the Prisma row written on create/insert. */
export function toExecutionCreateData(
  execution: AdminReminderExecution,
): Prisma.ReminderExecutionUncheckedCreateInput {
  return {
    id: execution.id,
    ruleId: execution.ruleId,
    dedupeKey: execution.dedupeKey,
    status: (execStatusToDb[execution.status] ?? "pending") as "pending",
    sentAt: execution.sentAt,
    error: execution.errorMessage,
  };
}

/** Map a domain execution's status to the Prisma row written on update. */
export function toExecutionUpdateData(execution: AdminReminderExecution): {
  status: "pending" | "sent" | "failed";
  sentAt: Date | null;
  error: string | null;
} {
  return {
    status: (execStatusToDb[execution.status] ?? "pending") as "pending",
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
 * (`ReminderExecution_dedupeKey_key`). Under the pg driver adapter `meta.target`
 * is unset, so the index identity lives in `message` /
 * `meta.driverAdapterError.cause.originalMessage`; both — and the classic
 * engine's column-name form — contain the `dedupeKey` substring. Since the
 * caller only inserts a `ReminderExecution`, that substring uniquely
 * identifies this conflict; any other violation returns false (and re-throws).
 */
export function isDedupeKeyConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { driverAdapterError?: { cause?: { originalMessage?: unknown } } };
  };
  if (candidate.code !== "P2002") return false;
  const original = candidate.meta?.driverAdapterError?.cause?.originalMessage;
  const identity = `${typeof candidate.message === "string" ? candidate.message : ""} ${typeof original === "string" ? original : ""}`;
  return identity.includes("dedupeKey");
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
 * Extracts recipientEmail from dedupeKey. Two key shapes are in flight in v6.0:
 *
 *   Legacy (BUG-023, v2.0):     `${ruleId}:<ISO with Z>:${email}`
 *     example: `<uuid>:2026-04-12T10:00:00.000Z:user@example.com`
 *
 *   Phase 28+ (NOTIF-04/02):    `${ruleId}:${kind}:YYYY-MM-DD:${email}`
 *     example: `<uuid>:deadline:2026-04-12:user@example.com`
 *     example: `<uuid>:escalation:2026-04-12:head@example.com`
 *
 * Phase 32-C / H-02: the legacy regex `/Z:(.+)$/` returned '' for every Phase
 * 28+ key (no `Z:`), silently breaking AdminReminderExecution.recipientEmail.
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
  status: string;
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
    status: dbExecStatusToDomain[execution.status] ?? "queued",
    scheduledFor: execution.createdAt,
    sentAt: execution.sentAt,
    recipientEmail: extractRecipientEmail(execution.dedupeKey),
    errorMessage: execution.error,
  });
}
