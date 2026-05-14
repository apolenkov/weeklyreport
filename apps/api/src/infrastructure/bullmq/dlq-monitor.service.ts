import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { QueueEvents, Queue } from "bullmq";

import { dlqFailedTotal } from "../metrics/metrics.registry.js";
import { getBullMQOptions } from "./bullmq-options";

const QUEUE_NAMES = ["email-reminder", "pdf-export"] as const;
type QueueName = (typeof QUEUE_NAMES)[number];

const DEFAULT_THRESHOLD = 5;
const POLL_INTERVAL_MS = 60_000;

/**
 * 37-02 — DLQ monitor. Two responsibilities:
 *
 *   1. Increment cr_dlq_failed_total{queue} every time a BullMQ job exhausts
 *      its retry budget (attemptsMade >= attempts). This is the
 *      Prometheus-rate signal that ops graphs and that alertmanager rules
 *      hang off.
 *   2. Every POLL_INTERVAL_MS, compare the absolute failed-job count from
 *      Redis against DLQ_ALERT_THRESHOLD (env, default 5). When exceeded,
 *      emit a structured ERROR log line. Repeated emissions are fine —
 *      alertmanager dedups upstream.
 *
 * QueueEvents is the right BullMQ surface for cross-process listening: it
 * subscribes to Redis pub/sub channels rather than embedding inside a
 * Worker, so failures observed by ANY worker for the queue increment our
 * counter exactly once.
 */
@Injectable()
export class DLQMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DLQMonitorService.name);
  private readonly queueEvents: Map<QueueName, QueueEvents> = new Map();
  private readonly queues: Map<QueueName, Queue> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;

  async onModuleInit(): Promise<void> {
    const bullOptions = getBullMQOptions();

    for (const name of QUEUE_NAMES) {
      const events = new QueueEvents(name, bullOptions);
      const queue = new Queue(name, bullOptions);

      events.on("failed", async ({ jobId, failedReason, prev }) => {
        // BullMQ emits 'failed' for every retry too. Only count terminal
        // failures (the job has moved into the failed-set, i.e. attemptsMade
        // has reached the configured `attempts` limit). The cleanest signal:
        // load the job and check it's actually been moved.
        try {
          const job = await queue.getJob(jobId);
          if (!job) return;
          const attemptsConfigured = job.opts.attempts ?? 1;
          if ((job.attemptsMade ?? 0) >= attemptsConfigured) {
            dlqFailedTotal.inc({ queue: name });
            this.logger.error(
              `[dlq] job ${jobId} on ${name} exhausted ${attemptsConfigured} attempts: ${failedReason ?? "unknown"}`,
            );
          }
        } catch (err) {
          // Don't let metrics-side bookkeeping crash the queue listener.
          this.logger.warn(
            `[dlq] failed to inspect terminal failure for ${name}/${jobId}: ${err instanceof Error ? err.message : String(err)} (prev=${prev ?? "n/a"})`,
          );
        }
      });

      this.queueEvents.set(name, events);
      this.queues.set(name, queue);
    }

    const threshold = Number(
      process.env["DLQ_ALERT_THRESHOLD"] ?? DEFAULT_THRESHOLD,
    );
    this.pollTimer = setInterval(() => {
      void this.checkThresholds(threshold);
    }, POLL_INTERVAL_MS);
    // Don't keep the event loop alive on shutdown.
    this.pollTimer.unref?.();

    this.logger.log(
      `DLQ monitor active for queues=[${QUEUE_NAMES.join(",")}], alert threshold=${threshold}, poll=${POLL_INTERVAL_MS}ms`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const events of this.queueEvents.values()) {
      await events.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }

  private async checkThresholds(threshold: number): Promise<void> {
    for (const [name, queue] of this.queues) {
      try {
        const count = await queue.getFailedCount();
        if (count > threshold) {
          this.logger.error(
            `[dlq-alert] queue=${name} failedCount=${count} threshold=${threshold} — investigate via /admin/queues`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `[dlq] threshold check failed for ${name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
