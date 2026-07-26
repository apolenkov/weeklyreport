import type { Role } from "@customreport/shared";

import {
  ANONYMOUS_USER_ID,
  NO_CORRELATION_ID,
} from "../../lib/actor-sentinels.js";
import type { TrpcContext } from "./trpc.context.js";

// Best-effort target from common id keys; productId precedes groupId
// (product is the attached/detached entity).
const TARGET_ID_KEYS = [
  "sectionId",
  "reportId",
  "periodId",
  "projectId",
  "leadId",
  "id",
  "userId",
  "productId",
  "groupId",
] as const;

const MAX_AUDIT_REASON_LENGTH = 500;

function truncateReason(reason: string): string {
  if (reason.length <= MAX_AUDIT_REASON_LENGTH) return reason;
  return reason.slice(0, MAX_AUDIT_REASON_LENGTH).trimEnd();
}

function extractAuditTarget(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const targetKey = TARGET_ID_KEYS.find(
    (key) => typeof record[key] === "string",
  );
  return targetKey ? (record[targetKey] as string) : undefined;
}

interface UserActionLogEntry {
  readonly userId: string;
  readonly role: Role | null;
  readonly procedure: string;
  // null, not undefined: the column is nullable and both write NULL, but an
  // explicit undefined property is not assignable to Prisma's create input.
  readonly targetId: string | null;
  // The Prisma enum, not string: the column is an enum and a widened type
  // would let a typo through to the write.
  readonly status: "success" | "fail";
  readonly reason: string | null;
  readonly durationMs: number;
}

// Durable half of the audit trail. Best-effort: a persist failure is warned
// about, never propagated, so audit bookkeeping cannot fail the mutation that
// already succeeded. No-op for callers without a Prisma client (unit callers).
async function persistUserActionLog(
  ctx: TrpcContext,
  entry: UserActionLogEntry,
): Promise<void> {
  if (!ctx.prisma?.userActionLog) return;
  try {
    await ctx.prisma.userActionLog.create({
      data: {
        ...entry,
        ip: ctx.ip,
        correlationId: ctx.correlationId ?? NO_CORRELATION_ID,
      },
    });
  } catch (error) {
    ctx.logger.warn("user action log persist failed", {
      phase: "audit.persist",
      procedure: entry.procedure,
      status: entry.status,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: typeof error, message: String(error) },
    });
  }
}

interface MutationAuditRecord {
  readonly procedure: string;
  readonly rawInput: unknown;
  readonly status: "success" | "fail";
  // The untruncated failure message, or null on success. Only the durable row
  // is truncated — the log stream keeps the full text.
  readonly failureReason: string | null;
  readonly durationMs: number;
}

// Emits both halves of the mutation audit trail: the log-stream event and the
// durable row. No before/after diff — outcome is success|fail with the failure
// reason only.
export async function recordMutationAudit(
  ctx: TrpcContext,
  record: MutationAuditRecord,
): Promise<void> {
  const target = extractAuditTarget(record.rawInput);
  const userId = ctx.session?.userId ?? ANONYMOUS_USER_ID;
  const role = ctx.session?.role ?? null;

  ctx.auditLogger.mutation({
    userId,
    role,
    ip: ctx.ip,
    procedure: record.procedure,
    target,
    status: record.status,
    duration: record.durationMs,
    ...(record.failureReason === null ? {} : { reason: record.failureReason }),
  });

  await persistUserActionLog(ctx, {
    userId,
    role,
    procedure: record.procedure,
    targetId: target ?? null,
    status: record.status,
    reason:
      record.failureReason === null
        ? null
        : truncateReason(record.failureReason),
    durationMs: record.durationMs,
  });
}
