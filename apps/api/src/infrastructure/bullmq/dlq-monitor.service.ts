import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { type Queue, QueueEvents } from "bullmq";

import type { EnvConfig } from "../config/env.schema";
import { dlqFailedTotal } from "../metrics/metrics.registry.js";
import { getBullMQOptions } from "./bullmq-options";
import {
  QUEUE_NAMES,
  type QueueName,
  QueueRegistry,
} from "./queue-registry.js";

const DEFAULT_THRESHOLD = 5;
const POLL_INTERVAL_MS = 60_000;

/**
 * DLQ monitor. Two responsibilities:
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
 * counter exactly once. The `Queue` handles come from QueueRegistry (shared,
 * closed there); only the QueueEvents subscribers are owned here.
 */
@Injectable()
export class DLQMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DLQMonitorService.name);
  private readonly queueEvents = new Map<QueueName, QueueEvents>();
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly registry: QueueRegistry,
    private readonly env: EnvConfig,
  ) {}

  onModuleInit(): void {
    const bullOptions = getBullMQOptions(this.env);

    for (const name of QUEUE_NAMES) {
      const events = new QueueEvents(name, bullOptions);
      const queue = this.registry.get(name);

      events.on("failed", ({ jobId, failedReason }) => {
        // The QueueEvents emitter expects a void-returning listener and ignores
        // any returned promise, so the async work is fire-and-forget. The
        // handler never rejects (all awaits are guarded inside the method).
        void this.recordTerminalFailure(name, queue, jobId, failedReason);
      });

      this.queueEvents.set(name, events);
    }

    // Absent → the named default; a present value is already a validated
    // positive int (env.schema `z.coerce.number()`), so no parse/guard here.
    const threshold = this.env.DLQ_ALERT_THRESHOLD ?? DEFAULT_THRESHOLD;
    this.pollTimer = setInterval(() => {
      void this.checkThresholds(threshold);
    }, POLL_INTERVAL_MS);
    // Don't keep the event loop alive on shutdown.
    this.pollTimer.unref();

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
  }

  /**
   * Increment `cr_dlq_failed_total{queue}` exactly once per terminal failure.
   * BullMQ emits 'failed' for every retry too, so only a job whose
   * `attemptsMade` has reached its configured `attempts` counts as terminal.
   * This monitor is the sole owner of the counter — no worker handler must
   * also increment it, or terminal failures would be double-counted.
   */
  private async recordTerminalFailure(
    name: QueueName,
    queue: Queue,
    jobId: string,
    failedReason: string,
  ): Promise<void> {
    try {
      const job = await queue.getJob(jobId);
      if (!job) return;
      const attemptsConfigured = job.opts.attempts ?? 1;
      if (job.attemptsMade >= attemptsConfigured) {
        dlqFailedTotal.inc({ queue: name });
        this.logger.error(
          `[dlq] job ${jobId} on ${name} exhausted ${attemptsConfigured} attempts: ${failedReason}`,
        );
      }
    } catch (error) {
      // Don't let metrics-side bookkeeping crash the queue listener.
      this.logger.warn(
        `[dlq] failed to inspect terminal failure for ${name}/${jobId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async checkThresholds(threshold: number): Promise<void> {
    for (const name of QUEUE_NAMES) {
      try {
        const count = await this.registry.get(name).getFailedCount();
        if (count > threshold) {
          this.logger.error(
            `[dlq-alert] queue=${name} failedCount=${count} threshold=${threshold} — investigate via /admin/queues`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `[dlq] threshold check failed for ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
