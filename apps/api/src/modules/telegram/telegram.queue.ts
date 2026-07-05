// Phase 55 (UFB-056): Telegram outbound BullMQ worker — seeds-only.
//
// The worker consumes jobs of shape `{ chatId: string; text: string }` from
// the `telegram-outbound` queue (registered in BullMQModule) and dispatches
// them through the resolved TelegramAdapter. In Phase 55 the only producer
// is `admin.testTelegramSend`, which is admin-only and proves the wiring
// without needing a real bot.
//
// Worker shape mirrors EmailReminderProcessor (Phase 28-03) deliberately:
//   - raw `new Worker(...)` on OnModuleInit, not @Processor — works around
//     the @nestjs/bullmq 11 + NestJS 11 DiscoveryService DI bug.
//   - structured-JSON failure log on the `failed` event so the existing
//     log dashboard surfaces telegram-outbound errors uniformly.
// Retries are configured at job-enqueue time (`attempts: 3`) so the queue
// itself stays generic.

import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { type Job, Worker } from "bullmq";
import type { ClsService } from "nestjs-cls";

import { getBullMQOptions } from "../../infrastructure/bullmq/bullmq-options";
import {
  extractTraceId,
  type JobTraceContext,
  runInJobTraceContext,
} from "../../infrastructure/bullmq/worker-observability.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { TELEGRAM_ADAPTER, type TelegramAdapter } from "./telegram.adapter.js";

/**
 * Job-data shape for `telegram-outbound`. Kept intentionally minimal — the
 * adapter is the only consumer, and the queue does not carry rendering
 * concerns (a future producer that wants templating renders before enqueue).
 */
export interface TelegramOutboundJobData extends JobTraceContext {
  chatId: string;
  text: string;
}

export const TELEGRAM_OUTBOUND_QUEUE_NAME = "telegram-outbound" as const;

/**
 * Default BullMQ job options used by every enqueue path. Centralised here
 * so producers don't drift on retry policy. `attempts: 3` matches the
 * `EmailReminderProcessor` family; `backoff` is exponential with a 5s
 * floor so a transient Telegram 429 has room to settle.
 */
export const TELEGRAM_OUTBOUND_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

@Injectable()
export class TelegramProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<TelegramOutboundJobData> | undefined;
  private readonly logger: AppLogger;

  constructor(
    @Inject(TELEGRAM_ADAPTER) private readonly adapter: TelegramAdapter,
    private readonly env: EnvConfig,
    logger?: AppLogger,
    private readonly cls?: ClsService,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  onModuleInit(): void {
    this.worker = new Worker<TelegramOutboundJobData>(
      TELEGRAM_OUTBOUND_QUEUE_NAME,
      async (job: Job<TelegramOutboundJobData>) => {
        await runInJobTraceContext(
          job.data,
          "telegram-outbound.process",
          this.cls,
          () => this.processJob(job),
        );
      },
      {
        ...getBullMQOptions(this.env),
        // Modest concurrency — Telegram per-bot rate limit is 30 msg/s in
        // private chats; seeds-only path only sees admin smoke tests, so
        // 2 in-flight is plenty.
        concurrency: 2,
      },
    );

    this.worker.on("failed", (job, error) => {
      this.logFailure(job, error);
    });
  }

  private logFailure(
    job: Job<TelegramOutboundJobData> | undefined,
    error: Error,
  ): void {
    const correlationId = job?.data.correlationId;
    const traceId = job ? extractTraceId(job.data) : undefined;
    // The DLQ monitor is the sole owner of cr_dlq_failed_total; this handler
    // only logs, so a terminal failure is counted exactly once.
    this.logger.error("telegram-outbound job failed", {
      chatId: job?.data.chatId,
      attempt: job?.attemptsMade,
      ...(correlationId ? { correlationId } : {}),
      ...(traceId ? { traceId } : {}),
      error: error.message,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<TelegramOutboundJobData>): Promise<void> {
    const { chatId, text } = job.data;
    const result = await this.adapter.send(chatId, text);
    if (!result.ok) {
      // Surface as job error so BullMQ retry logic kicks in. The adapter
      // is responsible for honouring rate-limits internally; reaching this
      // branch means an unrecoverable provider rejection.
      throw new Error(`telegram adapter rejected send for chat ${chatId}`);
    }
  }
}
