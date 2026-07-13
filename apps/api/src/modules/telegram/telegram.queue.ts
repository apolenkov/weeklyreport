// Telegram outbound BullMQ worker — seeds-only.
//
// The worker consumes jobs of shape `{ chatId: string; text: string }` from
// the `telegram-outbound` queue (registered in BullMQModule) and dispatches
// them through the resolved TelegramAdapter. The only producer
// is `admin.testTelegramSend`, which is admin-only and proves the wiring
// without needing a real bot.
//
// Lifecycle (raw `new Worker(...)`, trace/CLS wrapping, shutdown, and the
// structured-JSON `failed`-event log) is inherited from `RawBullMqProcessor`,
// the shared base its two siblings (`EmailReminderProcessor`,
// `PdfExportProcessor`) also extend; this file supplies only the queue name,
// span name, dispatch handler, failure hook, and concurrency override.
// Retries are configured at job-enqueue time (`attempts: 3`) so the queue
// itself stays generic.

import { Injectable } from "@nestjs/common";
import { type Job, type WorkerOptions } from "bullmq";
import type { ClsService } from "nestjs-cls";

import { RawBullMqProcessor } from "../../infrastructure/bullmq/raw-bullmq-processor.js";
import {
  extractTraceId,
  type JobTraceContext,
} from "../../infrastructure/bullmq/worker-observability.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import type { AppLogger } from "../../lib/logger.js";
import type { TelegramAdapter } from "./telegram.adapter.js";

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
export class TelegramProcessor extends RawBullMqProcessor<TelegramOutboundJobData> {
  protected readonly queueName = TELEGRAM_OUTBOUND_QUEUE_NAME;
  protected readonly spanName = "telegram-outbound.process";

  // Constructed by the module's useFactory (never by Nest's reflective DI) —
  // a param-decorator @Inject here would also break the web tsconfig's
  // es-decorators pass, so the adapter arrives as a plain constructor arg.
  constructor(
    private readonly adapter: TelegramAdapter,
    env: EnvConfig,
    logger?: AppLogger,
    cls?: ClsService,
  ) {
    super(env, logger, cls);
  }

  // Modest concurrency — Telegram per-bot rate limit is 30 msg/s in private
  // chats; seeds-only path only sees admin smoke tests, so 2 in-flight is
  // plenty.
  protected override extraWorkerOptions(): Partial<WorkerOptions> {
    return { concurrency: 2 };
  }

  protected onJobFailed(
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

  protected async processJob(job: Job<TelegramOutboundJobData>): Promise<void> {
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
