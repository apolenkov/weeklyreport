import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import type {
  PdfExportEnqueueInput,
  PdfExportEnqueuer,
  PdfExportJobContext,
} from "./pdf-export.ports.js";

// Three attempts with 5s exponential floor — matches EmailReminderProcessor
// so transient render/queue blips settle before DLQ.
const PDF_EXPORT_JOB_ATTEMPTS = 3;
const PDF_EXPORT_JOB_BACKOFF_DELAY_MS = 5000;

export class PdfExportBullmqEnqueuer implements PdfExportEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  readonly enqueue = async (
    input: PdfExportEnqueueInput,
    context: PdfExportJobContext,
  ): Promise<void> => {
    await this.queue.add(
      "generate",
      { ...input, ...context },
      {
        jobId: `${input.jobId}-g${input.generation}`,
        attempts: PDF_EXPORT_JOB_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: PDF_EXPORT_JOB_BACKOFF_DELAY_MS,
        },
      },
    );
  };
}
