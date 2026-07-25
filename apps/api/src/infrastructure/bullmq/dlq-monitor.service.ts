import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { type Queue, QueueEvents } from "bullmq";

import type { EnvConfig } from "../config/env.schema";
import {
  dlqFailedCurrent,
  dlqFailedTotal,
  queueDepth,
  redisMemoryUsedBytes,
} from "../metrics/metrics.registry.js";
import { getBullMQOptions } from "./bullmq-options";
import {
  QUEUE_NAMES,
  type QueueName,
  QueueRegistry,
} from "./queue-registry.js";

const DEFAULT_THRESHOLD = 5;
const POLL_INTERVAL_MS = 60_000;
// Warn once usage reaches this fraction of REDIS_MAXMEMORY_BYTES, leaving an
// operator time to act before Redis hits its own cap (and, above that, the
// container OOM-kill).
const REDIS_MEMORY_WARN_RATIO = 0.8;
const PERCENT_SCALE = 100;
const REDIS_MEMORY_WARN_PERCENT = REDIS_MEMORY_WARN_RATIO * PERCENT_SCALE;
// Any registry queue's shared connection can serve the INFO probe; the queues
// all point at the same Redis instance.
const MEMORY_PROBE_QUEUE = QUEUE_NAMES[0];

// Anchored `used_memory:` match excludes siblings like used_memory_rss/peak.
// Returns null when absent or non-numeric so the gauge is never set bogus.
function parseUsedMemoryBytes(info: string): number | null {
  const match = /^used_memory:(\d+)/m.exec(info);
  if (!match) return null;
  const [, raw] = match;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// QueueEvents (Redis pub/sub) so any worker's terminal failure increments the
// counter once; Queue handles come from QueueRegistry — only QueueEvents
// subscribers are owned here. Polls failed-count against DLQ_ALERT_THRESHOLD.
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
      void this.pollQueueMetrics(threshold);
      void this.checkRedisMemory();
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

  // Sole owner of cr_dlq_failed_total — workers must not also inc. BullMQ emits
  // 'failed' on every retry; only attemptsMade >= attempts is terminal.
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

  private async pollQueueMetrics(threshold: number): Promise<void> {
    await Promise.all([
      this.checkThresholds(threshold),
      this.checkQueueDepths(),
    ]);
  }

  private async checkThresholds(threshold: number): Promise<void> {
    for (const name of QUEUE_NAMES) {
      try {
        const count = await this.registry.get(name).getFailedCount();
        dlqFailedCurrent.set({ queue: name }, count);
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

  private async checkQueueDepths(): Promise<void> {
    await Promise.all(
      QUEUE_NAMES.map(async (name) => {
        try {
          // getJobCounts is typed as an open Record<string, number>; a state
          // BullMQ did not report means zero jobs in it, not a missing metric.
          const counts = await this.registry.get(name).getJobCounts();
          queueDepth.set(
            { queue: name, state: "waiting" },
            counts.waiting ?? 0,
          );
          queueDepth.set({ queue: name, state: "active" }, counts.active ?? 0);
          queueDepth.set(
            { queue: name, state: "delayed" },
            counts.delayed ?? 0,
          );
        } catch (error) {
          this.logger.warn(
            `[queue-depth] poll failed for ${name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );
  }

  private async checkRedisMemory(): Promise<void> {
    try {
      const client = await this.registry.get(MEMORY_PROBE_QUEUE).client;
      const used = parseUsedMemoryBytes(await client.info());
      if (used === null) {
        this.logger.warn(
          "[redis-mem] used_memory absent from INFO reply — skipping this poll",
        );
        return;
      }
      redisMemoryUsedBytes.set(used);
      const cap = this.env.REDIS_MAXMEMORY_BYTES;
      if (used >= cap * REDIS_MEMORY_WARN_RATIO) {
        this.logger.warn(
          `[redis-mem] used_memory=${used}B has crossed ${REDIS_MEMORY_WARN_PERCENT}% of cap=${cap}B — Redis nearing its memory limit`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `[redis-mem] memory poll failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
