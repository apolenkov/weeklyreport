import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
} from "@customreport/shared";

import type { AppLogger } from "../../lib/logger";
import type {
  RemindersEnqueuer,
  RemindersTelemetry,
} from "./reminders.ports.js";
import type { ReminderExecutionPayload } from "./reminders.types.js";
import { resolveReminderDedupeKey } from "./reminders-dedupe-key.js";
import {
  buildQueuePayload,
  type ReminderQueueJobData,
  type ReminderQueuePayload,
} from "./reminders-queue-payload.js";

export interface EnqueueContext {
  readonly queue: RemindersEnqueuer;
  readonly telemetry: RemindersTelemetry;
  readonly logger: AppLogger;
  readonly markExecutionFailed: (id: string, message: string) => Promise<void>;
}

export function buildExecutionCandidate(
  rule: AdminReminderRule,
  recipientEmail: string,
  payload: ReminderExecutionPayload | undefined,
): AdminReminderExecution {
  return adminReminderExecutionSchema.parse({
    id: crypto.randomUUID(),
    ruleId: rule.id,
    reportId: rule.reportId,
    dedupeKey: resolveReminderDedupeKey(rule, recipientEmail, payload),
    status: "queued",
    scheduledFor: rule.fireAt,
    sentAt: null,
    recipientEmail,
    errorMessage: null,
  });
}

async function addJob(
  ctx: EnqueueContext,
  executionId: string,
  data: ReminderQueueJobData,
  jobId: string = executionId,
): Promise<void> {
  await ctx.queue.enqueue(jobId, data, ctx.telemetry.captureJobContext());
}

// Sync enqueue throws become terminal failed (not swallowed) so queued rows
// without a job never linger; not rethrown so the tick continues.
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
  readonly insertExecutionOnConflict: (
    execution: AdminReminderExecution,
  ) => Promise<{
    readonly execution: AdminReminderExecution;
    readonly inserted: boolean;
  }>;
}

export async function recordExecutionOnConflict(
  repository: ExecutionRecorder,
  candidate: AdminReminderExecution,
): Promise<{ execution: AdminReminderExecution; inserted: boolean }> {
  return repository.insertExecutionOnConflict(candidate);
}

// Revive failed→queued via CAS; without it an exhausted-SMTP cycle reports
// "already sent" on manual re-dispatch (unified dedupe key). The queue context
// is required so a revive never mints a queued row with no worker behind it.
export async function reviveFailedExecution(
  ctx: EnqueueContext,
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
