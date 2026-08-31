import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { Queue } from "bullmq";

import { WorkerLivenessRegistry } from "../bullmq/worker-liveness.registry.js";
import { withReadinessTimeout } from "./readiness-timeout.js";

// The only Queue surface the probe touches; narrow so tests inject a stub
// without an erasing cast (BullMQ's Queue class has no usable interface).
type JobCountQueue = Pick<Queue, "getJobCounts">;

@Injectable()
export class BullMQHealthIndicator {
  private readonly logger = new Logger(BullMQHealthIndicator.name);

  constructor(
    @InjectQueue("pdf-export") private readonly pdfQueue: JobCountQueue,
    @InjectQueue("email-reminder") private readonly emailQueue: JobCountQueue,
    @Inject(WorkerLivenessRegistry)
    private readonly workerLiveness: WorkerLivenessRegistry,
    @Inject(HealthIndicatorService)
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const requiredWorkers = this.workerLiveness.requiredWorkers();
      if (!requiredWorkers.ready) {
        return this.healthIndicator.check(key).down({
          workers: requiredWorkers.workers,
        });
      }
      const counts = await withReadinessTimeout(
        "BullMQ job-count",
        Promise.all([
          this.pdfQueue.getJobCounts(),
          this.emailQueue.getJobCounts(),
        ]),
      );
      const [pdfCounts, emailCounts] = counts;

      return this.healthIndicator.check(key).up({
        pdf_export: { waiting: pdfCounts.waiting, active: pdfCounts.active },
        email_reminder: {
          waiting: emailCounts.waiting,
          active: emailCounts.active,
        },
        workers: requiredWorkers.workers,
      });
    } catch (error) {
      // The readiness body is served to unauthenticated callers: log the raw
      // queue error internally, never echo it in the response.
      this.logger.error("bullmq readiness probe failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.healthIndicator.check(key).down({
        ...(error instanceof Error && error.message.includes("timed out")
          ? { message: error.message }
          : {}),
      });
    }
  }
}
