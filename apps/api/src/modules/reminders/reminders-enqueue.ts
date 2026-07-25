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

export interface EnqueueContext {
  queue: RemindersEnqueuer;
  telemetry: RemindersTelemetry;
  logger: AppLogger;
  markExecutionFailed: (id: string, message: string) => Promise<void>;
}

async function addJob(
  ctx: EnqueueContext,
  executionId: string,
  data: Record<string, unknown>,
  jobId: string = executionId,
): Promise<void> {
  await ctx.queue.enqueue(jobId, data, ctx.telemetry.captureJobContext());
}

// Sync enqueue throws become terminal failed (not swallowed) so queued rows
// without a job never linger; not rethrown so the tick continues.
/**
 * Enqueue Or Mark Failed.
 * @param ctx - The ctx argument.
 * @param execution - The execution argument.
 * @param recipientEmail - The recipientEmail argument.
 * @param payload - The payload argument.
 * @param jobId - The jobId argument.
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
      execution.id,
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
    await ctx.markExecutionFailed(execution.id, message);
    return adminReminderExecutionSchema.parse({
      ...execution,
      status: "failed",
      errorMessage: message,
    });
  }
}

interface ExecutionRecorder {
  insertExecutionOnConflict(
    execution: AdminReminderExecution,
  ): Promise<{ execution: AdminReminderExecution; inserted: boolean }>;
}

/**
 * Record Execution On Conflict.
 * @param repository - The repository argument.
 * @param candidate - The candidate argument.
 */
export async function recordExecutionOnConflict(
  repository: ExecutionRecorder,
  candidate: AdminReminderExecution,
): Promise<{ execution: AdminReminderExecution; inserted: boolean }> {
  return repository.insertExecutionOnConflict(candidate);
}

// Revive failed→queued via CAS; without this a exhausted-SMTP cycle reports
// "already sent" on manual re-dispatch because of the unified dedupe key.
/**
 * Revive Failed Execution.
 * @param ctx - The ctx argument.
 * @param requeue - The requeue argument.
 * @param execution - The execution argument.
 * @param recipientEmail - The recipientEmail argument.
 * @param payload - The payload argument.
 */
export async function reviveFailedExecution(
  ctx: EnqueueContext | null,
  requeue: (executionId: string) => Promise<boolean>,
  execution: AdminReminderExecution,
  recipientEmail: string,
  payload: () => Promise<ReminderQueuePayload>,
): Promise<AdminReminderExecution | null> {
  if (execution.status !== "failed") return null;
  if (!(await requeue(execution.id))) return null;
  const requeued = adminReminderExecutionSchema.parse({
    ...execution,
    status: "queued",
    errorMessage: null,
  });
  if (!ctx) return requeued;
  // Fresh jobId — removeOnFail keeps the failed job; reusing execution.id is a no-op.
  return enqueueOrMarkFailed(
    ctx,
    requeued,
    recipientEmail,
    await payload(),
    `${execution.id}:revive:${crypto.randomUUID()}`,
  );
}

// Reaper: deterministic jobId dedups late originals; reconstructs plain-text shape.
/**
 * Re Enqueue Stuck.
 * @param ctx - The ctx argument.
 * @param execution - The execution argument.
 * @param reportPeriod - The reportPeriod argument.
 */
export async function reEnqueueStuck(
  ctx: EnqueueContext,
  execution: AdminReminderExecution,
  reportPeriod: string,
): Promise<void> {
  await addJob(
    ctx,
    execution.id,
    buildQueuePayload(execution, execution.recipientEmail, { reportPeriod }),
  );
  ctx.logger.info("reaper re-enqueued stuck execution", {
    executionId: execution.id,
  });
}
