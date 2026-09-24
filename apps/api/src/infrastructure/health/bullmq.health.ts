import {
  EMAIL_REMINDER_QUEUE_NAME,
  PDF_EXPORT_QUEUE_NAME,
} from "@customreport/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";

import { QUEUE_NAMES, QueueRegistry } from "../bullmq/queue-registry.js";
import { WorkerLivenessRegistry } from "../bullmq/worker-liveness.registry.js";
import { withReadinessTimeout } from "./readiness-timeout.js";

@Injectable()
export class BullMQHealthIndicator {
  private readonly logger = new Logger(BullMQHealthIndicator.name);

  constructor(
    @Inject(QueueRegistry) private readonly queues: QueueRegistry,
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
        Promise.all(
          QUEUE_NAMES.map(
            async (name) =>
              [name, await this.queues.get(name).getJobCounts()] as const,
          ),
        ),
      );
      const queueCounts = Object.fromEntries(
        counts.map(([name, queueCounts]) => [
          name,
          {
            waiting: queueCounts.waiting,
            active: queueCounts.active,
          },
        ]),
      );

      return this.healthIndicator.check(key).up({
        // Keep the health contract stable while exposing the exhaustive queue
        // map used by readiness checks and operations tooling.
        pdf_export: queueCounts[PDF_EXPORT_QUEUE_NAME],
        email_reminder: queueCounts[EMAIL_REMINDER_QUEUE_NAME],
        queues: queueCounts,
        workers: requiredWorkers.workers,
      });
    } catch (error) {
      // The readiness body is served to unauthenticated callers: log the raw
      // queue error internally, never echo it in the response.
      this.logger.error("bullmq readiness probe failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.healthIndicator.check(key).down();
    }
  }
}
