import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import type {
  ReminderEnqueueOptions,
  ReminderJobContext,
  RemindersEnqueuer,
} from "./reminders.ports.js";
import type { ReminderQueueJobData } from "./reminders-queue-payload.js";

// Three attempts with 5s exponential floor — matches EmailReminderProcessor
// so transient SMTP blips settle before DLQ.
const REMINDER_JOB_ATTEMPTS = 3;
const REMINDER_JOB_BACKOFF_DELAY_MS = 5000;

export class RemindersBullmqEnqueuer implements RemindersEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  readonly enqueue = async (
    executionId: string,
    data: ReminderQueueJobData,
    context: ReminderJobContext,
    options?: ReminderEnqueueOptions,
  ): Promise<void> => {
    if (options?.replaceTerminal && this.queue.getJob) {
      const existing = await this.queue.getJob(executionId);
      if (existing) {
        const state = await existing.getState();
        if (state !== "failed" && state !== "completed") {
          throw new Error(
            `Cannot replace non-terminal reminder job ${executionId} in ${state} state.`,
          );
        }
        await existing.remove();
      }
    }
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
