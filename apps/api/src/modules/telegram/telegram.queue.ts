// Outbound worker: only admin.testTelegramSend enqueues; lifecycle from
// RawBullMqProcessor. Retries are set at enqueue (attempts: 3).

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

export interface TelegramOutboundJobData extends JobTraceContext {
  chatId: string;
  text: string;
}

export const TELEGRAM_OUTBOUND_QUEUE_NAME = "telegram-outbound" as const;

// Centralised so producers don't drift on retry policy; the 5s exponential
// backoff floor gives a transient Telegram 429 room to settle.
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
