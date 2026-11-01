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
// is the attached/detached entity). The bounded recursive walk collects the
// identities present (depth- and count-capped, see MAX_AUDIT_*); the first key
// found in this order is the primary target.
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

// Bounds for the walk: a bulk payload must not inflate a single audit event,
// and the walk must stay bounded in depth and linear in the objects it visits,
// so a self-referencing input cannot exhaust the stack before
// recordMutationAudit's try/catch and drop the mutation outcome that an audit
// failure must not touch.
const MAX_AUDIT_TARGETS = 20;
const MAX_AUDIT_WALK_DEPTH = 8;

interface TargetAccumulator {
  readonly targets: Set<string>;
  truncated: boolean;
}

// Only the target cap stops the whole walk; a depth skip and a repeated object
// prune their own branch only, so the remaining branches stay walkable.
function walkStopped(acc: TargetAccumulator): boolean {
  return acc.truncated && acc.targets.size >= MAX_AUDIT_TARGETS;
}

function noteTarget(acc: TargetAccumulator, id: string): void {
  if (acc.targets.has(id)) return;
  if (acc.targets.size >= MAX_AUDIT_TARGETS) {
    // The 21st unique identity: the cap is reached, stop the walk.
    acc.truncated = true;
    return;
  }
  acc.targets.add(id);
}

// Every id-key value on one object, in TARGET_ID_KEYS order.
function collectIdKeys(
  record: Record<string, unknown>,
  acc: TargetAccumulator,
): void {
  for (const key of TARGET_ID_KEYS) {
    if (walkStopped(acc)) return;
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.length > 0) {
      noteTarget(acc, candidate);
    }
  }
}

// Collects every id-key value on one object, then recurses into the non-id
// children (nested objects and array elements).
function collectFromRecord(
  record: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
  acc: TargetAccumulator,
): void {
  collectIdKeys(record, acc);
  for (const [key, child] of Object.entries(record)) {
    if (walkStopped(acc)) return;
    if (!TARGET_ID_KEY_SET.has(key)) {
      collectAuditTargets(child, depth + 1, seen, acc);
    }
  }
}

// Depth-first walk collecting every value stored under a target id key, up to
// MAX_AUDIT_WALK_DEPTH levels and at most MAX_AUDIT_TARGETS distinct ids.
// Order follows TARGET_ID_KEYS precedence at each object, so the first element
// is the primary target.
function collectAuditTargets(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  acc: TargetAccumulator,
): void {
  if (value === null || typeof value !== "object") return;
  if (depth > MAX_AUDIT_WALK_DEPTH) {
    // Pruned branch beyond the depth cap: an identity may still live in the
    // skipped subtree, so the skip counts as truncation.
    acc.truncated = true;
    return;
  }
  if (seen.has(value)) return; // repeated object: pruned, not truncation
  seen.add(value);
  if (Array.isArray(value)) {
    for (const element of value) {
      if (walkStopped(acc)) return;
      collectAuditTargets(element, depth + 1, seen, acc);
    }
    return;
  }
  collectFromRecord(value as Record<string, unknown>, depth, seen, acc);
}

// Identities named by the mutation input, deduplicated in discovery order,
// bounded to MAX_AUDIT_TARGETS at MAX_AUDIT_WALK_DEPTH levels. `truncated` is
// true when any identity or branch was left out. An empty result means the
// input named no known identity key.
function extractAuditTargets(decodedInput: unknown): {
  readonly targets: readonly string[];
  readonly truncated: boolean;
} {
  const acc: TargetAccumulator = { targets: new Set(), truncated: false };
  collectAuditTargets(decodedInput, 0, new WeakSet<object>(), acc);
  return { targets: [...acc.targets], truncated: acc.truncated };
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
  const { targets, truncated } = extractAuditTargets(record.decodedInput);
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
      ...(truncated ? { truncated: true } : {}),
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
