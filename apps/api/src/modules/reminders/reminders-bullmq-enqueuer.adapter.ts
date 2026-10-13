import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import type { TerminalJobRemoval } from "../../infrastructure/bullmq/terminal-job-removal.js";
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
  constructor(
    private readonly queue: Pick<JobEnqueuer, "add">,
    private readonly terminalJobs: TerminalJobRemoval,
  ) {}

  private readonly replaceTerminal = async (
    executionId: string,
  ): Promise<void> => {
    const existing = await this.terminalJobs.getJob(executionId);
    if (!existing) return;
    const state = await existing.getState();
    if (state !== "failed" && state !== "completed") {
      throw new Error(
        `Cannot replace non-terminal reminder job ${executionId} in ${state} state.`,
      );
    }
    const outcome = await existing.removeIfTerminal("failed-or-completed");
    if (outcome === "state-changed") {
      const currentState = await existing.getState();
      throw new Error(
        `Cannot replace non-terminal reminder job ${executionId} in ${currentState} state.`,
      );
    }
    if (outcome === "identity-changed") {
      throw new Error(
        `Cannot replace reminder job ${executionId}: job identity changed.`,
      );
    }
  };

  readonly enqueue = async (
    executionId: string,
    data: ReminderQueueJobData,
    context: ReminderJobContext,
    options?: ReminderEnqueueOptions,
  ): Promise<void> => {
    if (options?.replaceTerminal) await this.replaceTerminal(executionId);
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
