import type { ReminderQueueJobData } from "./reminders-queue-payload.js";

export interface ReminderJobContext {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly correlationId?: string;
}

export interface RemindersEnqueuer {
  readonly enqueue: (
    executionId: string,
    data: ReminderQueueJobData,
    context: ReminderJobContext,
  ) => Promise<void>;
}

export interface RemindersTelemetry {
  readonly captureJobContext: () => ReminderJobContext;
}

export const REMINDERS_ENQUEUER = Symbol("RemindersEnqueuer");
export const REMINDERS_TELEMETRY = Symbol("RemindersTelemetry");

export const NOOP_REMINDERS_TELEMETRY: RemindersTelemetry = {
  captureJobContext: () => ({}),
};
