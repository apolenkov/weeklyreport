import type { TRPC_ERROR_CODE_KEY } from "@trpc/server";
import type { Role } from "@weeklyreport/shared";

import {
  ANONYMOUS_USER_ID,
  NO_CORRELATION_ID,
} from "../../lib/actor-sentinels.js";
import { auditPersistFailuresTotal } from "../metrics/metrics.registry.js";
import type { TrpcContext } from "./trpc.context.js";
import { deriveCauseInfo } from "./trpc.logging.js";

// Best-effort target from common id keys; productId precedes groupId (product
// is the attached/detached entity). The recursive walk collects every identity
// present; the first key found in this order is the primary target.
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
  // These specific subject keys follow the generic identities above, preserving
  // the generic key as the primary target when both appear in one input.
  "reportSectionId",
  "itemId",
  "riskId",
  "decisionId",
  "commentId",
  "activityId",
] as const;

// Exact-key membership for the recursion's skip set, derived from the ordered
// TARGET_ID_KEYS so the two can never drift.
const TARGET_ID_KEY_SET = new Set<string>(TARGET_ID_KEYS);

// Collects every id-key value on one object, then recurses into the non-id
// children (nested objects and array elements).
function collectFromRecord(
  record: Record<string, unknown>,
  targets: string[],
): void {
  for (const key of TARGET_ID_KEYS) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.length > 0) {
      targets.push(candidate);
    }
  }
  for (const [key, child] of Object.entries(record)) {
    if (!TARGET_ID_KEY_SET.has(key)) {
      collectAuditTargets(child, targets);
    }
  }
}

// Depth-first walk collecting every value stored under a target id key, at any
// depth and in every array element. Order follows TARGET_ID_KEYS precedence at
// each object, so the first element is the primary target.
function collectAuditTargets(value: unknown, targets: string[]): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const element of value) {
      collectAuditTargets(element, targets);
    }
    return;
  }
  collectFromRecord(value as Record<string, unknown>, targets);
}

// All identities named by the mutation input, deduplicated in discovery order.
// An empty result means the input named no known identity key.
function extractAuditTargets(decodedInput: unknown): readonly string[] {
  const targets: string[] = [];
  collectAuditTargets(decodedInput, targets);
  return [...new Set(targets)];
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

interface AuditFailure {
  readonly phase: "audit.stream" | "audit.persist";
  readonly message: string;
  readonly error: unknown;
}

// Durable half of the audit trail. Best-effort and independent of the log
// stream: a persist failure is returned for disclosure, never thrown, so audit
// bookkeeping cannot fail the mutation whose outcome is already fixed. No-op
// without a Prisma client (unit).
async function persistUserActionLog(
  ctx: MutationAuditContext,
  entry: UserActionLogEntry,
): Promise<AuditFailure | null> {
  if (!ctx.prisma?.userActionLog) return null;
  try {
    await ctx.prisma.userActionLog.create({
      data: {
        ...entry,
        ip: ctx.ip,
        correlationId: ctx.correlationId ?? NO_CORRELATION_ID,
      },
    });
    return null;
  } catch (error) {
    return {
      phase: "audit.persist",
      message: "user action log persist failed",
      error,
    };
  }
}

// Audit rows are security-relevant: a dropped record surfaces as an error log
// and a rising metric. Each disclosure step is guarded on its own; when the
// log itself fails, one stderr line (no retry, no recursion, no throw) keeps
// the loss visible.
function discloseAuditFailures(
  ctx: MutationAuditContext,
  record: Pick<MutationAuditRecord, "procedure" | "status">,
  failures: readonly AuditFailure[],
): void {
  const unlogged: string[] = [];
  for (const failure of failures) {
    if (failure.phase === "audit.persist") {
      try {
        auditPersistFailuresTotal.inc();
      } catch {
        // The log below still discloses the dropped row.
      }
    }
    try {
      ctx.logger.error(failure.message, {
        phase: failure.phase,
        procedure: record.procedure,
        status: record.status,
        error: deriveCauseInfo(failure.error) ?? { name: typeof failure.error },
      });
    } catch {
      unlogged.push(failure.phase);
    }
  }
  if (unlogged.length === 0) return;
  try {
    process.stderr.write(
      `audit reporting failed: ${record.procedure} ${unlogged.join(",")}\n`,
    );
  } catch {
    // Nothing is left to report to.
  }
}

type MutationAuditContext = Pick<
  TrpcContext,
  "session" | "logger" | "auditLogger" | "ip" | "prisma" | "correlationId"
>;

interface MutationAuditRecord {
  readonly procedure: string;
  // Only the procedure parser's output may reach target extraction. Raw
  // transport input can contain unknown keys that Zod strips before the
  // resolver and must never become durable audit metadata.
  readonly decodedInput: unknown;
  readonly status: "success" | "fail";
  // Fixed framework classification only. Error messages can contain decoded
  // input or database metadata and never cross into either audit sink.
  readonly failureCode: TRPC_ERROR_CODE_KEY | null;
  readonly durationMs: number;
}

// Emits both halves of the mutation audit trail: log-stream event + durable
// row. The envelope carries the primary target plus every resolved identity and
// no before/after diff — outcome is success|fail with the failure reason only.
export async function recordMutationAudit(
  ctx: MutationAuditContext,
  record: MutationAuditRecord,
): Promise<void> {
  const targets = extractAuditTargets(record.decodedInput);
  const target = targets[0];
  const userId = ctx.session?.userId ?? ANONYMOUS_USER_ID;
  const role = ctx.session?.role ?? null;
  const reason = record.failureCode;

  const failures: AuditFailure[] = [];
  try {
    ctx.auditLogger.mutation({
      userId,
      role,
      ip: ctx.ip,
      procedure: record.procedure,
      ...(target === undefined ? {} : { target }),
      ...(targets.length > 0 ? { targets } : {}),
      status: record.status,
      duration: record.durationMs,
      ...(reason === null ? {} : { reason }),
    });
  } catch (error) {
    failures.push({
      phase: "audit.stream",
      message: "audit log stream failed",
      error,
    });
  }

  const persistFailure = await persistUserActionLog(ctx, {
    userId,
    role,
    procedure: record.procedure,
    targetId: target ?? null,
    status: record.status,
    reason,
    durationMs: record.durationMs,
  });
  if (persistFailure) failures.push(persistFailure);
  if (failures.length > 0) discloseAuditFailures(ctx, record, failures);
}
