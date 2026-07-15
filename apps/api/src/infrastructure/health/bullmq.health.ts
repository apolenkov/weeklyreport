import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { Queue } from "bullmq";

/**
 * Upper bound on the Redis-backed job-count readiness probe. A wedged queue
 * connection must report down instead of hanging the whole readiness route.
 */
const JOB_COUNTS_TIMEOUT_MS = 2000;

@Injectable()
export class BullMQHealthIndicator {
  constructor(
    @InjectQueue("pdf-export") private readonly pdfQueue: Queue,
    @InjectQueue("email-reminder") private readonly emailQueue: Queue,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const timeout = new Promise<null>((resolve) => {
        const timer = setTimeout(() => resolve(null), JOB_COUNTS_TIMEOUT_MS);
        timer.unref();
      });
      const counts = await Promise.race([
        Promise.all([
          this.pdfQueue.getJobCounts(),
          this.emailQueue.getJobCounts(),
        ]),
        timeout,
      ]);
      if (counts === null) {
        return this.healthIndicator.check(key).down({
          message: `BullMQ job-count probe timed out after ${JOB_COUNTS_TIMEOUT_MS}ms`,
        });
      }
      const [pdfCounts, emailCounts] = counts;

      return this.healthIndicator.check(key).up({
        pdf_export: { waiting: pdfCounts.waiting, active: pdfCounts.active },
        email_reminder: {
          waiting: emailCounts.waiting,
          active: emailCounts.active,
        },
      });
    } catch (error) {
      return this.healthIndicator
        .check(key)
        .down({ message: (error as Error).message });
    }
  }
}
