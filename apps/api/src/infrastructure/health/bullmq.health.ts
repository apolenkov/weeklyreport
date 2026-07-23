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

function createProbeTimeout(): {
  promise: Promise<{ kind: "timeout" }>;
  cancel: () => void;
} {
  const promiseWithTimer = Promise.withResolvers<{ kind: "timeout" }>();
  const timer = setTimeout(
    () => promiseWithTimer.resolve({ kind: "timeout" }),
    JOB_COUNTS_TIMEOUT_MS,
  );
  timer.unref();
  return {
    promise: promiseWithTimer.promise,
    cancel: () => clearTimeout(timer),
  };
}

@Injectable()
export class BullMQHealthIndicator {
  constructor(
    @InjectQueue("pdf-export") private readonly pdfQueue: Queue,
    @InjectQueue("email-reminder") private readonly emailQueue: Queue,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const probe = Promise.all([
      this.pdfQueue.getJobCounts(),
      this.emailQueue.getJobCounts(),
    ]).then(
      (counts) => ({ kind: "counts" as const, counts }),
      (error: unknown) => ({ kind: "error" as const, error }),
    );
    const timeout = createProbeTimeout();
    try {
      const outcome = await Promise.race([probe, timeout.promise]);
      if (outcome.kind === "timeout") {
        return this.healthIndicator.check(key).down({
          message: `BullMQ job-count probe timed out after ${JOB_COUNTS_TIMEOUT_MS}ms`,
        });
      }
      if (outcome.kind === "error") {
        return this.healthIndicator.check(key).down({
          message:
            outcome.error instanceof Error
              ? outcome.error.message
              : String(outcome.error),
        });
      }
      const { counts } = outcome;
      const [pdfCounts, emailCounts] = counts;

      return this.healthIndicator.check(key).up({
        pdf_export: { waiting: pdfCounts.waiting, active: pdfCounts.active },
        email_reminder: {
          waiting: emailCounts.waiting,
          active: emailCounts.active,
        },
      });
    } finally {
      timeout.cancel();
    }
  }
}
