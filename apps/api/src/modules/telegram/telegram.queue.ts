// Outbound worker: only admin.testTelegramSend enqueues; lifecycle from
// RawBullMqProcessor. Retries are set at enqueue (attempts: 3).

import { Inject, Injectable } from "@nestjs/common";
import { type Job, type WorkerOptions } from "bullmq";
import { ClsService } from "nestjs-cls";

import { RawBullMqProcessor } from "../../infrastructure/bullmq/raw-bullmq-processor.js";
import {
  extractTraceId,
  type JobTraceContext,
} from "../../infrastructure/bullmq/worker-observability.js";
import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { TELEGRAM_ADAPTER, type TelegramAdapter } from "./telegram.adapter.js";

export interface TelegramOutboundJobData extends JobTraceContext {
  chatId: string;
  text: string;
}

export const TELEGRAM_OUTBOUND_QUEUE_NAME = "telegram-outbound" as const;

// Bounded Redis retention. Completed jobs survive only long enough for a quick
// "did it go out?" check; failures are kept deeper because a DLQ postmortem
// needs the payload after the fact.
const RETAINED_COMPLETED_JOBS = 100;
const RETAINED_FAILED_JOBS = 500;

// Centralised so producers don't drift on retry policy; the 5s exponential
// backoff floor gives a transient Telegram 429 room to settle.
export const TELEGRAM_OUTBOUND_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { count: RETAINED_COMPLETED_JOBS },
  removeOnFail: { count: RETAINED_FAILED_JOBS },
};

@Injectable()
export class TelegramProcessor extends RawBullMqProcessor<TelegramOutboundJobData> {
  protected readonly queueName = TELEGRAM_OUTBOUND_QUEUE_NAME;
  protected readonly spanName = "telegram-outbound.process";

  constructor(
    @Inject(TELEGRAM_ADAPTER) private readonly adapter: TelegramAdapter,
    @Inject(ENV_CONFIG) env: EnvConfig,
    @Inject(APP_LOGGER) logger: AppLogger,
    @Inject(ClsService) cls: ClsService | null,
  ) {
    super(env, logger, cls);
  }

  // Modest concurrency — Telegram per-bot rate limit is 30 msg/s in private
  // chats; seeds-only path only sees admin smoke tests, so 2 in-flight is
  // plenty.
  protected override readonly extraWorkerOptions =
    (): Partial<WorkerOptions> => ({ concurrency: 2 });

  protected readonly onJobFailed = (
    job: Job<TelegramOutboundJobData> | undefined,
    error: Error,
  ): void => {
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
  };

  protected readonly processJob = async (
    job: Job<TelegramOutboundJobData>,
  ): Promise<void> => {
    const { chatId, text } = job.data;
    const result = await this.adapter.send(chatId, text);
    if (!result.ok) {
      // Surface as job error so BullMQ retry logic kicks in. The adapter
      // is responsible for honouring rate-limits internally; reaching this
      // branch means an unrecoverable provider rejection.
      throw new Error(`telegram adapter rejected send for chat ${chatId}`);
    }
  };
}
