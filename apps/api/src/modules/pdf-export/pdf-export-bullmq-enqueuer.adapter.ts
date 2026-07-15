import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import type {
  PdfExportEnqueueInput,
  PdfExportEnqueuer,
  PdfExportJobContext,
} from "./pdf-export.ports.js";

export class PdfExportBullmqEnqueuer implements PdfExportEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  async enqueue(
    input: PdfExportEnqueueInput,
    context: PdfExportJobContext,
  ): Promise<void> {
    await this.queue.add(
      "generate",
      { ...input, ...context },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );
  }
}
