import {
  type AdminReminderExecution,
  adminReminderExecutionSchema,
  type AdminReminderRule,
} from "@weeklyreport/shared";

import { errorMessage } from "../../lib/error-message.js";
import type { AppLogger } from "../../lib/logger";
import type {
  ReminderEnqueueOptions,
  RemindersEnqueuer,
  RemindersTelemetry,
} from "./reminders.ports.js";
import type {
  ReminderExecutionPayload,
  ReminderExecutionRecordResult,
} from "./reminders.types.js";
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
  payload: ReminderExecutionPayload,
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
  data: ReminderQueueJobData,
  jobId: string = data.executionId,
  options?: ReminderEnqueueOptions,
): Promise<void> {
  await ctx.queue.enqueue(
    jobId,
    data,
    ctx.telemetry.captureJobContext(),
    options,
  );
}

// Sync enqueue throws become terminal failed (not swallowed) so queued rows
// without a job never linger; not rethrown so the tick continues.
export async function enqueueOrMarkFailed(
  ctx: EnqueueContext,
  execution: AdminReminderExecution,
  message: {
    readonly recipientEmail: string;
    readonly payload: ReminderQueuePayload;
  },
  jobId?: string,
): Promise<AdminReminderExecution> {
  try {
    await addJob(
      ctx,
      buildQueuePayload(execution, message.recipientEmail, message.payload),
      jobId,
    );
    ctx.logger.info("enqueued email reminder job", {
      executionId: execution.id,
    });
    return execution;
  } catch (error: unknown) {
    const message = errorMessage(error);
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
    payload: ReminderQueuePayload,
    allowFailedRevival?: boolean,
  ) => Promise<ReminderExecutionRecordResult>;
}

export async function recordExecutionOnConflict(
  repository: ExecutionRecorder,
  candidate: AdminReminderExecution,
  payload: ReminderQueuePayload,
  allowFailedRevival?: boolean,
): Promise<ReminderExecutionRecordResult> {
  return repository.insertExecutionOnConflict(
    candidate,
    payload,
    allowFailedRevival,
  );
}

// Reaper: replace a retained terminal job before re-adding the same execution
// id. A late original remains harmless because the processor CAS-claims once.
export async function reEnqueueStuck(
  ctx: EnqueueContext,
  execution: AdminReminderExecution,
  payload: ReminderQueuePayload,
): Promise<void> {
  await addJob(
    ctx,
    buildQueuePayload(execution, execution.recipientEmail, payload),
    execution.id,
    { replaceTerminal: true },
  );
  ctx.logger.info("reaper re-enqueued stuck execution", {
    executionId: execution.id,
  });
}
