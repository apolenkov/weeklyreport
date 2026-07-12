import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
} from "@customreport/shared";
import type { ClsService } from "nestjs-cls";

import type {
  JobEnqueueOptions,
  JobEnqueuer,
} from "../../infrastructure/bullmq/job-enqueuer.js";
import {
  captureJobTraceContext,
  resolveCorrelationId,
} from "../../infrastructure/bullmq/worker-observability.js";
import type { AppLogger } from "../../lib/logger";
import type { ReminderExecutionPayload } from "./reminders.service.js";
import { buildQueuePayload } from "./reminders-queue-payload.js";

/**
 * Retry/backoff shared by every email-reminder enqueue — the scheduler's
 * initial `add` and the reaper's re-enqueue — so both paths land jobs with
 * identical durability. Centralized rather than copy-pasted per call site.
 */
export const EMAIL_REMINDER_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
} as const satisfies JobEnqueueOptions;

/** Collaborators the enqueue helpers need from the owning service. */
export interface EnqueueContext {
  queue: JobEnqueuer;
  cls: ClsService | undefined;
  logger: AppLogger;
  markExecutionFailed?: (id: string, message: string) => Promise<void>;
}

async function addJob(
  ctx: EnqueueContext,
  execution: AdminReminderExecution,
  data: Record<string, unknown>,
): Promise<void> {
  await ctx.queue.add(
    "send",
    { ...data, ...captureJobTraceContext(resolveCorrelationId(ctx.cls)) },
    { ...EMAIL_REMINDER_JOB_OPTIONS, jobId: execution.id },
  );
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
  rule: AdminReminderRule,
  payload?: ReminderExecutionPayload,
): Promise<AdminReminderExecution> {
  try {
    await addJob(
      ctx,
      execution,
      buildQueuePayload(execution, recipientEmail, rule, payload),
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
  rule: AdminReminderRule,
): Promise<void> {
  await addJob(
    ctx,
    execution,
    buildQueuePayload(execution, execution.recipientEmail, rule),
  );
  ctx.logger.info("reaper re-enqueued stuck execution", {
    executionId: execution.id,
  });
}
