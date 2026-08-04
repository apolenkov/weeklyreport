import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { Queue } from "bullmq";

// Upper bound on the Redis-backed job-count readiness probe: a wedged queue
// connection must report down instead of hanging the whole readiness route.
const JOB_COUNTS_TIMEOUT_MS = 2000;

// The only Queue surface the probe touches; narrow so tests inject a stub
// without an erasing cast (BullMQ's Queue class has no usable interface).
type JobCountQueue = Pick<Queue, "getJobCounts">;

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
  private readonly logger = new Logger(BullMQHealthIndicator.name);

  constructor(
    @InjectQueue("pdf-export") private readonly pdfQueue: JobCountQueue,
    @InjectQueue("email-reminder") private readonly emailQueue: JobCountQueue,
    @Inject(HealthIndicatorService)
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
        // The readiness body is served to unauthenticated callers: log the raw
        // queue error internally, never echo it in the response.
        this.logger.error("bullmq readiness probe failed", {
          error:
            outcome.error instanceof Error
              ? outcome.error.message
              : String(outcome.error),
        });
        return this.healthIndicator.check(key).down();
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
