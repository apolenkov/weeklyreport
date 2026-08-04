import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import type {
  ReminderJobContext,
  RemindersEnqueuer,
} from "./reminders.ports.js";
import type { ReminderQueueJobData } from "./reminders-queue-payload.js";

// Three attempts with 5s exponential floor — matches EmailReminderProcessor
// and telegram-outbound so transient SMTP blips settle before DLQ.
const REMINDER_JOB_ATTEMPTS = 3;
const REMINDER_JOB_BACKOFF_DELAY_MS = 5000;

export class RemindersBullmqEnqueuer implements RemindersEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  readonly enqueue = async (
    executionId: string,
    data: ReminderQueueJobData,
    context: ReminderJobContext,
  ): Promise<void> => {
    await this.queue.add(
      "send",
      { ...data, ...context },
      {
        attempts: REMINDER_JOB_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: REMINDER_JOB_BACKOFF_DELAY_MS,
        },
        jobId: executionId,
      },
    );
  };
}
