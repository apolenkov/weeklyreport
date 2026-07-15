export interface ReminderJobContext {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly correlationId?: string;
}

export interface RemindersEnqueuer {
  enqueue(
    executionId: string,
    data: Readonly<Record<string, unknown>>,
    context: ReminderJobContext,
  ): Promise<void>;
}

export interface RemindersTelemetry {
  captureJobContext(): ReminderJobContext;
}

export const REMINDERS_ENQUEUER = Symbol("RemindersEnqueuer");
export const REMINDERS_TELEMETRY = Symbol("RemindersTelemetry");

export const NOOP_REMINDERS_TELEMETRY: RemindersTelemetry = {
  captureJobContext: () => ({}),
};
