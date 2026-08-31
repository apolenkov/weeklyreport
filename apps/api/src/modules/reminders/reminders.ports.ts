import type { JobTraceContext } from "../../lib/job-trace-context.js";
import type { ReminderQueueJobData } from "./reminders-queue-payload.js";

export type ReminderJobContext = JobTraceContext;

export interface ReminderEnqueueOptions {
  /** Replace only a terminal job retained under the same execution id. */
  readonly replaceTerminal?: boolean;
}

export interface RemindersEnqueuer {
  readonly enqueue: (
    executionId: string,
    data: ReminderQueueJobData,
    context: ReminderJobContext,
    options?: ReminderEnqueueOptions,
  ) => Promise<void>;
}

export interface RemindersTelemetry {
  readonly captureJobContext: () => ReminderJobContext;
  readonly recordUncertainDelivery: (count: number) => void;
}

export const REMINDERS_ENQUEUER = Symbol("RemindersEnqueuer");
export const REMINDERS_TELEMETRY = Symbol("RemindersTelemetry");

export const NOOP_REMINDERS_TELEMETRY: RemindersTelemetry = {
  captureJobContext: () => ({}),
  recordUncertainDelivery: () => undefined,
};
