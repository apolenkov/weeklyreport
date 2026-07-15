import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import type {
  ReminderJobContext,
  RemindersEnqueuer,
} from "./reminders.ports.js";

export class RemindersBullmqEnqueuer implements RemindersEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  async enqueue(
    executionId: string,
    data: Readonly<Record<string, unknown>>,
    context: ReminderJobContext,
  ): Promise<void> {
    await this.queue.add(
      "send",
      { ...data, ...context },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        jobId: executionId,
      },
    );
  }
}
