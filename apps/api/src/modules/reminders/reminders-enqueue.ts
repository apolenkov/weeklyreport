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
): Promise<void> {
  await ctx.queue.enqueue(
    execution.id,
    data,
    ctx.telemetry.captureJobContext(),
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
  payload: ReminderQueuePayload,
): Promise<AdminReminderExecution> {
  try {
    await addJob(
      ctx,
      execution,
      buildQueuePayload(execution, recipientEmail, payload),
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
