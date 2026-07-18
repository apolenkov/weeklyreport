import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
} from "@customreport/shared";

import type { AppLogger } from "../../lib/logger";
import type {
  RemindersEnqueuer,
  RemindersTelemetry,
} from "./reminders.ports.js";
import {
  buildQueuePayload,
  type ReminderQueuePayload,
} from "./reminders-queue-payload.js";

/** Collaborators the enqueue helpers need from the owning service. */
export interface EnqueueContext {
  queue: RemindersEnqueuer;
  telemetry: RemindersTelemetry;
  logger: AppLogger;
  markExecutionFailed?: (id: string, message: string) => Promise<void>;
}

async function addJob(
  ctx: EnqueueContext,
  execution: AdminReminderExecution,
  data: Record<string, unknown>,
  jobId: string = execution.id,
): Promise<void> {
  await ctx.queue.enqueue(jobId, data, ctx.telemetry.captureJobContext());
}

/**
 * Enqueue the just-inserted execution's email job. A synchronous `add` throw
 * (Redis down, and the like) is recorded as a terminal `failed` state on the
 * row rather than swallowed — otherwise a committed `queued` row with no job
 * would linger invisibly. The failure is not rethrown, so a scheduler tick
 * continues to its remaining recipients.
 */
export async function enqueueOrMarkFailed(
  ctx: EnqueueContext,
  execution: AdminReminderExecution,
  recipientEmail: string,
  payload: ReminderQueuePayload,
  jobId?: string,
): Promise<AdminReminderExecution> {
  try {
    await addJob(
      ctx,
      execution,
      buildQueuePayload(execution, recipientEmail, payload),
      jobId,
    );
    ctx.logger.info("enqueued email reminder job", {
      executionId: execution.id,
    });
    return execution;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger.error("failed to enqueue email reminder job", {
      executionId: execution.id,
      error: message,
    });
    await ctx.markExecutionFailed?.(execution.id, message);
    return adminReminderExecutionSchema.parse({
      ...execution,
      status: "failed",
      errorMessage: message,
    });
  }
}

/** The persistence slice `recordExecutionOnConflict` needs. */
interface ExecutionRecorder {
  insertExecutionOnConflict?(
    execution: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }>;
  findExecutionByDedupeKey(
    dedupeKey: string,
  ): Promise<AdminReminderExecution | null>;
  saveExecution(
    execution: AdminReminderExecution,
  ): Promise<AdminReminderExecution>;
}

/**
 * Record the execution row, preferring the repository's atomic
 * insert-on-conflict. Repositories without it (in-memory test doubles) fall
 * back to check-then-insert — safe there because nothing races them;
 * production takes the atomic path.
 */
export async function recordExecutionOnConflict(
  repository: ExecutionRecorder,
  candidate: AdminReminderExecution,
): Promise<{ execution: AdminReminderExecution; inserted: boolean }> {
  if (repository.insertExecutionOnConflict) {
    return repository.insertExecutionOnConflict(candidate);
  }
  const existing = await repository.findExecutionByDedupeKey(
    candidate.dedupeKey,
  );
  if (existing) {
    return { execution: existing, inserted: false };
  }
  const saved = await repository.saveExecution(candidate);
  return { execution: saved, inserted: true };
}

/**
 * Manual-retry path: atomically revive a terminally `failed` execution
 * (failed → queued via the repository CAS; exactly one concurrent caller
 * wins) and re-enqueue its email. Returns null when the row was not revived
 * — not `failed`, or a concurrent revival won — so the caller falls back to
 * the plain deduplicated return. Without this, the unified dedupe key makes
 * a cycle whose send exhausted its SMTP attempts permanently report
 * "already sent" to a manual re-dispatch.
 */
export async function reviveFailedExecution(
  ctx: EnqueueContext | null,
  requeue: ((executionId: string) => Promise<boolean>) | undefined,
  execution: AdminReminderExecution,
  recipientEmail: string,
  payload: () => Promise<ReminderQueuePayload>,
): Promise<AdminReminderExecution | null> {
  if (execution.status !== "failed") return null;
  if (!requeue || !(await requeue(execution.id))) return null;
  const requeued = adminReminderExecutionSchema.parse({
    ...execution,
    status: "queued",
    errorMessage: null,
  });
  if (!ctx) return requeued;
  // Fresh jobId: the original failed job is retained by removeOnFail, and the
  // queue backend silently dedups an add against ANY still-existing jobId —
  // reusing execution.id would make the revival a no-op. At-most-once send is
  // still guaranteed by the revival CAS plus the worker's own send claim.
  return enqueueOrMarkFailed(
    ctx,
    requeued,
    recipientEmail,
    await payload(),
    `${execution.id}:revive:${crypto.randomUUID()}`,
  );
}

/**
 * Reaper path: re-enqueue an execution stranded in `queued`. The deterministic
 * `jobId` lets the queue backend dedup against any late-arriving original, and
 * the worker's compare-and-set send guard guarantees exactly-once delivery. The
 * rich template fields are not persisted, so the legacy plain-text job shape is
 * reconstructed.
 */
export async function reEnqueueStuck(
  ctx: EnqueueContext,
  execution: AdminReminderExecution,
  reportPeriod: string,
): Promise<void> {
  await addJob(
    ctx,
    execution,
    buildQueuePayload(execution, execution.recipientEmail, { reportPeriod }),
  );
  ctx.logger.info("reaper re-enqueued stuck execution", {
    executionId: execution.id,
  });
}
